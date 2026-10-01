'use server';

import { createSession, getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { notifyStructureStaff, type NotificationMessage } from '@/lib/notifications';
import { insertUserAccount, isUserEmailTaken, parseAccountFormData, type AccountInput } from '@/lib/accounts';
import { sanitizeModules } from '@/lib/modules';
import { getBusinessTrialEndDate } from '@/lib/trial';
import {
  buildAccountCreatedMail,
  buildBusinessWelcomeMail,
  buildLicenseChangedMails,
  buildModulesChangedMails,
  getOrganizationAdminRecipients,
  queueMail,
} from '@/lib/emails';
import { getLocale, getT } from '@/lib/i18n/server';
import type { Translator } from '@/lib/i18n/translate';

// ─────────────────────────────────────────────────────────
// Organisations (Super Admin + inscription publique)
//
// Une organisation porte la licence et les modules. Son ORG_ADMIN crée
// ensuite les points (structures) et leurs administrateurs depuis
// /organization — voir app/actions/organizations.ts.
// ─────────────────────────────────────────────────────────

function parseModulesFromFormData(formData: FormData): string[] {
  const raw = formData.getAll('modules').flatMap((value) =>
    String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
  return sanitizeModules(raw);
}

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type LicenseInput = {
  plan: string;
  maxUsers: number;
  maxTables: number;
  maxPoints: number;
  expiresAt: string | null;
};

type OrganizationRegistrationInput = {
  organizationName: string;
  organizationEmail: string;
  city: string;
  modules: string[];
  admin: AccountInput;
  license: LicenseInput;
};

function parseOrganizationRegistrationFormData(
  formData: FormData,
  t: Translator
): { data: OrganizationRegistrationInput } | { error: string } {
  const organizationName = String(formData.get('organizationName') || '').trim();
  const organizationEmail = String(formData.get('organizationEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();

  if (!organizationName || !organizationEmail || !city) {
    return { error: t('business.errors.missingFields') };
  }

  const account = parseAccountFormData(formData, 'admin', t);
  if ('error' in account) return account;

  return {
    data: {
      organizationName,
      organizationEmail,
      city,
      modules: parseModulesFromFormData(formData),
      admin: account.data,
      license: {
        plan: 'FREE',
        maxUsers: 5,
        maxTables: 10,
        maxPoints: parsePositiveInt(formData.get('maxPoints'), 1),
        expiresAt: null,
      },
    },
  };
}

async function createOrganizationWithAdminCore(
  input: OrganizationRegistrationInput,
  options?: { autoLogin?: boolean }
): Promise<{
  success: boolean;
  error: string;
  organizationId?: string;
  redirect?: string;
  trialEndsAt?: string;
}> {
  const { t } = await getT();
  try {
    const admin = getAdminSupabase();

    const { data: existingOrganization } = await admin
      .from('organizations')
      .select('id')
      .eq('email', input.organizationEmail)
      .maybeSingle();

    if (existingOrganization) {
      return { success: false, error: t('business.errors.organizationEmailTaken') };
    }

    if (await isUserEmailTaken(input.admin.email)) {
      return { success: false, error: t('business.errors.adminEmailTaken') };
    }

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({
        name: input.organizationName,
        email: input.organizationEmail,
        city: input.city,
        modules: input.modules,
      })
      .select('id, modules')
      .single();

    if (organizationError || !organization) {
      return { success: false, error: t('business.errors.createFailed') };
    }

    const { error: licenseError } = await admin.from('licenses').insert({
      organization_id: organization.id,
      plan: input.license.plan,
      max_users: input.license.maxUsers,
      max_tables: input.license.maxTables,
      max_points: input.license.maxPoints,
      is_active: true,
      expires_at: input.license.expiresAt,
    });

    const created = licenseError
      ? { error: t('business.errors.licenseCreateFailed') }
      : await insertUserAccount(input.admin, {
          role: 'ORG_ADMIN',
          organizationId: organization.id,
        });

    if ('error' in created) {
      // ON DELETE CASCADE supprime aussi la licence éventuellement créée.
      await admin.from('organizations').delete().eq('id', organization.id);
      return { success: false, error: created.error };
    }

    const adminUser = created.user;
    // Langue de la personne qui crée le compte (le nouveau compte n'en a pas encore).
    const locale = await getLocale();
    if (options?.autoLogin) {
      // Inscription publique : l'administrateur connaît son mot de passe.
      queueMail(async () =>
        buildBusinessWelcomeMail({
          email: adminUser.email,
          firstName: input.admin.firstName,
          organizationName: input.organizationName,
          trialEndsAt: input.license.expiresAt,
          locale,
        })
      );
    } else {
      // Créée par le super admin : identifiant + lien pour choisir son mot de passe.
      queueMail(() =>
        buildAccountCreatedMail({
          userId: adminUser.id,
          email: adminUser.email,
          firstName: input.admin.firstName,
          role: 'ORG_ADMIN',
          scopeName: input.organizationName,
          locale,
        })
      );
    }

    if (options?.autoLogin) {
      await createSession({
        userId: created.user.id,
        email: created.user.email,
        role: 'ORG_ADMIN',
        organizationId: organization.id,
        modules: (organization.modules as string[]) || input.modules,
        licenseActive: true,
      });
    }

    return {
      success: true,
      error: '',
      organizationId: organization.id,
      redirect: options?.autoLogin ? '/organization' : undefined,
      trialEndsAt: input.license.expiresAt ?? undefined,
    };
  } catch {
    return { success: false, error: t('business.errors.createFailed') };
  }
}

async function requireSuperAdmin() {
  const session = await getSession();
  return session?.role === 'SUPER_ADMIN' ? session : null;
}

/** Notifie les responsables de chaque point d'une organisation. */
async function notifyOrganizationPoints(
  organizationId: string,
  notification: { message: NotificationMessage; url?: string }
) {
  const admin = getAdminSupabase();
  const { data: points } = await admin
    .from('structures')
    .select('id')
    .eq('organization_id', organizationId);

  await Promise.all(
    (points || []).map((point) =>
      notifyStructureStaff({
        structureId: point.id,
        ...notification,
        roles: ['ADMIN', 'MANAGER'],
      })
    )
  );
}

export async function getAllOrganizations() {
  if (!(await requireSuperAdmin())) return [];

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from('organizations')
      .select(
        'id, name, email, city, modules, created_at, ' +
          // * : inclut api_monthly_orders après docs/phase13-api.sql sans casser avant
          'licenses!organization_id(*), ' +
          'structures!organization_id(id, name, city, is_active), ' +
          'users!organization_id(id, email, first_name, last_name, role, is_active)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getAllOrganizations] error:', error);
      return [];
    }

    return (data || []).map(({ users, ...organization }: any) => ({
      ...organization,
      orgAdmins: (users || []).filter((u: any) => u.role === 'ORG_ADMIN'),
    }));
  } catch {
    return [];
  }
}

export async function createOrganizationWithAdmin(
  _prevState: { success: boolean; error: string; organizationId?: string },
  formData: FormData
) {
  const { t } = await getT();
  if (!(await requireSuperAdmin())) {
    return { success: false, error: t('business.errors.unauthorized') };
  }

  const parsed = parseOrganizationRegistrationFormData(formData, t);
  if ('error' in parsed) {
    return { success: false, error: parsed.error };
  }

  const result = await createOrganizationWithAdminCore(parsed.data);
  if (result.success) revalidatePath('/structures');
  return result;
}

export async function registerBusiness(
  _prevState: {
    success: boolean;
    error: string;
    redirect?: string;
    trialEndsAt?: string;
  },
  formData: FormData
) {
  const { t } = await getT();
  const parsed = parseOrganizationRegistrationFormData(formData, t);
  if ('error' in parsed) {
    return { success: false, error: parsed.error };
  }

  const trialEndIso = getBusinessTrialEndDate().toISOString();

  const result = await createOrganizationWithAdminCore(
    {
      ...parsed.data,
      license: {
        plan: 'TRIAL',
        maxUsers: 5,
        maxTables: 10,
        maxPoints: 3,
        expiresAt: trialEndIso,
      },
    },
    { autoLogin: true }
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    error: '',
    redirect: result.redirect ?? '/organization',
    trialEndsAt: result.trialEndsAt ?? trialEndIso,
  };
}

export async function updateOrganizationLicense(
  organizationId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const { t } = await getT();
  if (!(await requireSuperAdmin())) {
    return { success: false, error: t('business.errors.unauthorized') };
  }

  const isActive = String(formData.get('isActive') || 'false') === 'true';
  const expiresAtRaw = String(formData.get('expiresAt') || '').trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;
  const maxPoints = parsePositiveInt(formData.get('maxPoints'), 1);

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('licenses')
      .upsert(
        {
          organization_id: organizationId,
          is_active: isActive,
          expires_at: expiresAt,
          max_points: maxPoints,
        },
        { onConflict: 'organization_id' }
      );

    if (error) {
      return { success: false, error: t('business.errors.licenseUpdateFailed') };
    }

    // Quota de commandes API (docs/phase13-api.sql), enregistré à part pour ne
    // pas bloquer la licence si la migration n'est pas encore appliquée.
    if (formData.has('apiMonthlyOrders')) {
      const raw = String(formData.get('apiMonthlyOrders') || '').trim();
      const quota = raw === '' ? null : Math.max(0, Number.parseInt(raw, 10) || 0);
      const { error: quotaError } = await admin
        .from('licenses')
        .update({ api_monthly_orders: quota })
        .eq('organization_id', organizationId);
      if (quotaError) console.warn('[updateOrganizationLicense] quota API non enregistré :', quotaError.message);
    }

    queueMail(async () => {
      const [{ data: organization }, recipients] = await Promise.all([
        getAdminSupabase().from('organizations').select('name').eq('id', organizationId).maybeSingle(),
        getOrganizationAdminRecipients(organizationId),
      ]);
      return buildLicenseChangedMails({
        recipients,
        organizationName: organization?.name,
        isActive,
        expiresAt,
        maxPoints,
      });
    });

    await notifyOrganizationPoints(organizationId, {
      message: ({ t }) => ({
        title: t('notify.licenseStatus.title'),
        body: isActive ? t('notify.licenseStatus.activated') : t('notify.licenseStatus.suspended'),
      }),
      url: '/dashboard',
    });

    revalidatePath('/structures');
    return { success: true, error: '' };
  } catch {
    return { success: false, error: t('business.errors.licenseUpdateFailed') };
  }
}

/**
 * Met à jour une organisation. Les modules de la licence sont recopiés sur
 * tous ses points (structures.modules), lus par le reste de l'application.
 */
export async function updateOrganization(
  organizationId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const { t } = await getT();
  if (!(await requireSuperAdmin())) {
    return { success: false, error: t('business.errors.unauthorized') };
  }

  const name = String(formData.get('organizationName') || '').trim();
  const email = String(formData.get('organizationEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();
  const modules = parseModulesFromFormData(formData);

  if (!name || !email) {
    return { success: false, error: t('business.errors.nameEmailRequired') };
  }

  try {
    const admin = getAdminSupabase();
    const { data: previous } = await admin
      .from('organizations')
      .select('modules')
      .eq('id', organizationId)
      .maybeSingle();
    const previousModules = sanitizeModules(previous?.modules);

    const { error } = await admin
      .from('organizations')
      .update({
        name,
        email,
        ...(city ? { city } : {}),
        modules,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId);

    if (error) {
      console.error('Organization Update Error:', error);
      return { success: false, error: t('business.errors.updateFailed') };
    }

    const { error: syncError } = await admin
      .from('structures')
      .update({ modules })
      .eq('organization_id', organizationId);

    if (syncError) {
      console.error('Organization modules sync error:', syncError);
      return { success: false, error: t('business.errors.modulesNotPropagated') };
    }

    const added = modules.filter((m) => !previousModules.includes(m));
    const removed = previousModules.filter((m) => !modules.includes(m));
    if (added.length || removed.length) {
      queueMail(async () =>
        buildModulesChangedMails({
          recipients: await getOrganizationAdminRecipients(organizationId),
          organizationName: name,
          added,
          removed,
        })
      );
    }

    await notifyOrganizationPoints(organizationId, {
      message: ({ t }) => ({
        title: t('notify.licenseModules.title'),
        body: t('notify.licenseModules.body', { name }),
      }),
      url: '/settings',
    });

    revalidatePath('/structures');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Organization Update Catch Error:', error);
    return { success: false, error: t('business.errors.updateFailed') };
  }
}

/** Crée un administrateur d'organisation (ex. organisations migrées sans ORG_ADMIN). */
export async function createOrganizationAdmin(
  organizationId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const { t } = await getT();
  if (!(await requireSuperAdmin())) {
    return { success: false, error: t('business.errors.unauthorized') };
  }

  const account = parseAccountFormData(formData, 'admin', t);
  if ('error' in account) return { success: false, error: account.error };

  const created = await insertUserAccount(account.data, {
    role: 'ORG_ADMIN',
    organizationId,
  });
  if ('error' in created) return { success: false, error: created.error };

  const locale = await getLocale();
  queueMail(async () => {
    const { data: organization } = await getAdminSupabase()
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    return buildAccountCreatedMail({
      userId: created.user.id,
      email: created.user.email,
      firstName: account.data.firstName,
      role: 'ORG_ADMIN',
      scopeName: organization?.name,
      locale,
    });
  });

  revalidatePath('/structures');
  return { success: true, error: '' };
}

export async function deleteOrganization(organizationId: string) {
  const { t } = await getT();
  if (!(await requireSuperAdmin())) {
    return { success: false, error: t('business.errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();
    // ON DELETE CASCADE : points, licence, comptes et données des points.
    const { error } = await admin.from('organizations').delete().eq('id', organizationId);

    if (error) {
      return { success: false, error: t('business.errors.deleteFailed') };
    }

    revalidatePath('/structures');
    return { success: true };
  } catch {
    return { success: false, error: t('business.errors.deleteFailed') };
  }
}

// ─────────────────────────────────────────────────────────
// updateStructureSettings — mise à jour des paramètres de
// l'établissement par l'ADMIN ou MANAGER.
// ─────────────────────────────────────────────────────────
export async function updateStructureSettings(
  _prevState: { success: boolean; error: string },
  formData: FormData
): Promise<{ success: boolean; error: string }> {
  const { t } = await getT();
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
    return { success: false, error: t('common.unauthorized') };
  }

  const structureId = session.structureId;
  if (!structureId) {
    return { success: false, error: t('settings.errors.noStructure') };
  }

  const name     = String(formData.get('name') || '').trim();
  const email    = String(formData.get('email') || '').trim().toLowerCase();
  const phone    = String(formData.get('phone') || '').trim() || null;
  const address  = String(formData.get('address') || '').trim() || null;
  const city     = String(formData.get('city') || '').trim() || null;
  const country  = String(formData.get('country') || '').trim() || null;
  const currency = String(formData.get('currency') || 'XAF').trim();
  const timezone = String(formData.get('timezone') || 'Africa/Douala').trim();
  const type     = String(formData.get('type') || 'RESTAURANT').trim();
  const logo_url = String(formData.get('logo_url') || '').trim() || null;
  const taxRate  = Number(formData.get('tax_rate') || 0);
  const takeawayFee = Number(formData.get('takeaway_fee') || 0);

  if (!name || !email) {
    return { success: false, error: t('settings.errors.nameEmailRequired') };
  }

  if (!['RESTAURANT', 'HOTEL', 'MIXTE'].includes(type)) {
    return { success: false, error: t('settings.errors.invalidType') };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('structures')
      .update({
        name,
        email,
        phone,
        address,
        city,
        country,
        currency,
        timezone,
        type,
        logo_url,
        tax_rate: isNaN(taxRate) ? 0 : taxRate,
        takeaway_fee: isNaN(takeawayFee) ? 0 : takeawayFee,
        updated_at: new Date().toISOString(),
      })
      .eq('id', structureId);

    if (error) {
      console.error('[updateStructureSettings] update error:', error.message);
      return { success: false, error: t('settings.errors.updateFailed') };
    }

    // Identité fiscale et régime de TVA (colonnes de docs/phase9-fiscal.sql),
    // enregistrés à part pour ne pas bloquer le reste si la migration manque.
    const { error: fiscalError } = await admin
      .from('structures')
      .update({
        niu: String(formData.get('niu') || '').trim().toUpperCase() || null,
        rccm: String(formData.get('rccm') || '').trim().toUpperCase() || null,
        prices_include_tax: String(formData.get('prices_include_tax') ?? 'true') !== 'false',
      })
      .eq('id', structureId);

    if (fiscalError) {
      console.error('[updateStructureSettings] fiscal error:', fiscalError.message);
      return {
        success: false,
        error: t('settings.errors.fiscalMigration'),
      };
    }

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true, error: '' };
  } catch (err: any) {
    console.error('[updateStructureSettings] error:', err);
    return { success: false, error: t('common.genericError') };
  }
}
