'use server';

import { createSession, getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { notifyStructureStaff } from '@/app/actions/push';
import { insertUserAccount, isUserEmailTaken, parseAccountFormData, type AccountInput } from '@/lib/accounts';
import { sanitizeModules } from '@/lib/modules';
import { getBusinessTrialEndDate } from '@/lib/trial';
import {
  buildAccountCreatedMail,
  buildBusinessWelcomeMail,
  buildLicenseChangedMail,
  buildModulesChangedMail,
  getOrganizationAdminEmails,
  queueMail,
} from '@/lib/emails';

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
  formData: FormData
): { data: OrganizationRegistrationInput } | { error: string } {
  const organizationName = String(formData.get('organizationName') || '').trim();
  const organizationEmail = String(formData.get('organizationEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();

  if (!organizationName || !organizationEmail || !city) {
    return { error: 'Tous les champs obligatoires doivent être remplis.' };
  }

  const account = parseAccountFormData(formData, 'admin');
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
  try {
    const admin = getAdminSupabase();

    const { data: existingOrganization } = await admin
      .from('organizations')
      .select('id')
      .eq('email', input.organizationEmail)
      .maybeSingle();

    if (existingOrganization) {
      return { success: false, error: 'Une organisation utilise déjà cet email professionnel.' };
    }

    if (await isUserEmailTaken(input.admin.email)) {
      return { success: false, error: 'Un compte existe déjà avec cet email administrateur.' };
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
      return { success: false, error: "Échec de la création de l'organisation." };
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
      ? { error: 'Échec de la création de la licence.' }
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
    if (options?.autoLogin) {
      // Inscription publique : l'administrateur connaît son mot de passe.
      queueMail(async () =>
        buildBusinessWelcomeMail({
          email: adminUser.email,
          firstName: input.admin.firstName,
          organizationName: input.organizationName,
          trialEndsAt: input.license.expiresAt,
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
    return { success: false, error: "Échec de la création de l'organisation." };
  }
}

async function requireSuperAdmin() {
  const session = await getSession();
  return session?.role === 'SUPER_ADMIN' ? session : null;
}

/** Notifie les responsables de chaque point d'une organisation. */
async function notifyOrganizationPoints(
  organizationId: string,
  notification: { title: string; body: string; url?: string }
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
          'licenses!organization_id(is_active, expires_at, plan, max_users, max_tables, max_points), ' +
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
  if (!(await requireSuperAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = parseOrganizationRegistrationFormData(formData);
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
  const parsed = parseOrganizationRegistrationFormData(formData);
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
  if (!(await requireSuperAdmin())) {
    return { success: false, error: 'Unauthorized' };
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
      return { success: false, error: 'Failed to update license' };
    }

    queueMail(async () => {
      const [{ data: organization }, to] = await Promise.all([
        getAdminSupabase().from('organizations').select('name').eq('id', organizationId).maybeSingle(),
        getOrganizationAdminEmails(organizationId),
      ]);
      if (!to.length) return null;
      return buildLicenseChangedMail({
        to,
        organizationName: organization?.name ?? 'votre organisation',
        isActive,
        expiresAt,
        maxPoints,
      });
    });

    await notifyOrganizationPoints(organizationId, {
      title: 'Mise à jour de licence',
      body: `Le statut de la licence de votre organisation a été mis à jour par le Super Administrateur (Actif: ${isActive}).`,
      url: '/dashboard',
    });

    revalidatePath('/structures');
    return { success: true, error: '' };
  } catch {
    return { success: false, error: 'Failed to update license' };
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
  if (!(await requireSuperAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  const name = String(formData.get('organizationName') || '').trim();
  const email = String(formData.get('organizationEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();
  const modules = parseModulesFromFormData(formData);

  if (!name || !email) {
    return { success: false, error: 'Name and email are required' };
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
      return { success: false, error: error.message || 'Failed to update organization' };
    }

    const { error: syncError } = await admin
      .from('structures')
      .update({ modules })
      .eq('organization_id', organizationId);

    if (syncError) {
      console.error('Organization modules sync error:', syncError);
      return { success: false, error: 'Modules non propagés aux points.' };
    }

    const added = modules.filter((m) => !previousModules.includes(m));
    const removed = previousModules.filter((m) => !modules.includes(m));
    if (added.length || removed.length) {
      queueMail(async () => {
        const to = await getOrganizationAdminEmails(organizationId);
        return to.length ? buildModulesChangedMail({ to, organizationName: name, added, removed }) : null;
      });
    }

    await notifyOrganizationPoints(organizationId, {
      title: 'Licence modifiée',
      body: `Les modules de l'organisation ${name} ont été mis à jour. Reconnectez-vous pour en profiter.`,
      url: '/settings',
    });

    revalidatePath('/structures');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Organization Update Catch Error:', error);
    return { success: false, error: error.message || 'Failed to update organization' };
  }
}

/** Crée un administrateur d'organisation (ex. organisations migrées sans ORG_ADMIN). */
export async function createOrganizationAdmin(
  organizationId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  if (!(await requireSuperAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  const account = parseAccountFormData(formData, 'admin');
  if ('error' in account) return { success: false, error: account.error };

  const created = await insertUserAccount(account.data, {
    role: 'ORG_ADMIN',
    organizationId,
  });
  if ('error' in created) return { success: false, error: created.error };

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
      scopeName: organization?.name ?? 'votre organisation',
    });
  });

  revalidatePath('/structures');
  return { success: true, error: '' };
}

export async function deleteOrganization(organizationId: string) {
  if (!(await requireSuperAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();
    // ON DELETE CASCADE : points, licence, comptes et données des points.
    const { error } = await admin.from('organizations').delete().eq('id', organizationId);

    if (error) {
      return { success: false, error: 'Failed to delete organization' };
    }

    revalidatePath('/structures');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete organization' };
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
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const structureId = session.structureId;
  if (!structureId) {
    return { success: false, error: 'Aucune structure associée à ce compte.' };
  }

  const name     = String(formData.get('name') || '').trim();
  const email    = String(formData.get('email') || '').trim().toLowerCase();
  const phone    = String(formData.get('phone') || '').trim() || null;
  const address  = String(formData.get('address') || '').trim() || null;
  const city     = String(formData.get('city') || '').trim() || null;
  const country  = String(formData.get('country') || '').trim() || null;
  const currency = String(formData.get('currency') || 'XOF').trim();
  const timezone = String(formData.get('timezone') || 'Africa/Abidjan').trim();
  const type     = String(formData.get('type') || 'RESTAURANT').trim();
  const logo_url = String(formData.get('logo_url') || '').trim() || null;
  const taxRate  = Number(formData.get('tax_rate') || 0);
  const takeawayFee = Number(formData.get('takeaway_fee') || 0);

  if (!name || !email) {
    return { success: false, error: 'Le nom et l\'email sont obligatoires.' };
  }

  if (!['RESTAURANT', 'HOTEL', 'MIXTE'].includes(type)) {
    return { success: false, error: 'Type d\'établissement invalide.' };
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
      return { success: false, error: error.message || 'Erreur lors de la mise à jour.' };
    }

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true, error: '' };
  } catch (err: any) {
    console.error('[updateStructureSettings] error:', err);
    return { success: false, error: err?.message || 'Erreur serveur.' };
  }
}
