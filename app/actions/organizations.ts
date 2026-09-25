'use server';

import { getSession, type SessionPayload } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { insertUserAccount, parseAccountFormData } from '@/lib/accounts';
import { firstOf, isLicenseValid } from '@/lib/license';
import { sanitizeModules } from '@/lib/modules';
import { CAMEROON_VAT_RATE } from '@/lib/tax';
import {
  buildAccountCreatedMail,
  buildAccountStatusMail,
  buildPointStatusMails,
  getPointAdminRecipients,
  getUserLocale,
  queueMail,
} from '@/lib/emails';
import { getLocale, getT } from '@/lib/i18n/server';
import type { Translator } from '@/lib/i18n/translate';

// ─────────────────────────────────────────────────────────
// Espace ORG_ADMIN : l'administrateur d'une organisation crée ses points
// et leurs administrateurs. Chaque point est ensuite géré de façon
// indépendante par son ADMIN (toutes les données restent scopées par
// structure_id) et hérite des modules de la licence de l'organisation.
// ─────────────────────────────────────────────────────────

type ActionState = { success: boolean; error: string; pointId?: string };

const POINT_TYPES = ['RESTAURANT', 'HOTEL', 'MIXTE'];

async function requireOrgAdmin(): Promise<
  (SessionPayload & { organizationId: string }) | null
> {
  const session = await getSession();
  if (!session || session.role !== 'ORG_ADMIN' || !session.organizationId) {
    return null;
  }
  return session as SessionPayload & { organizationId: string };
}

/** Garantit que le point appartient bien à l'organisation de l'ORG_ADMIN. */
async function getOwnedPoint(organizationId: string, pointId: string) {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('structures')
    .select('id, name, email, phone, address, city, type, is_active, created_at')
    .eq('id', pointId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return data;
}

function parsePointFormData(
  formData: FormData,
  t: Translator
):
  | { data: { name: string; email: string; city: string; type: string; phone: string | null; address: string | null } }
  | { error: string } {
  const name = String(formData.get('pointName') || '').trim();
  const email = String(formData.get('pointEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();
  const type = String(formData.get('pointType') || 'RESTAURANT').trim();
  const phone = String(formData.get('phone') || '').trim() || null;
  const address = String(formData.get('address') || '').trim() || null;

  if (!name || !email || !city) {
    return { error: t('org.errors.pointRequired') };
  }
  if (!POINT_TYPES.includes(type)) {
    return { error: t('org.errors.invalidType') };
  }
  return { data: { name, email, city, type, phone, address } };
}

async function isPointEmailTaken(email: string, exceptPointId?: string) {
  const admin = getAdminSupabase();
  let query = admin.from('structures').select('id').eq('email', email);
  if (exceptPointId) query = query.neq('id', exceptPointId);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}

export async function getMyOrganizationOverview() {
  const session = await requireOrgAdmin();
  if (!session) return null;

  const admin = getAdminSupabase();
  const [{ data: organization }, { data: points }] = await Promise.all([
    admin
      .from('organizations')
      .select(
        'id, name, email, city, modules, created_at, licenses!organization_id(plan, is_active, expires_at, max_points, max_users, max_tables)'
      )
      .eq('id', session.organizationId)
      .maybeSingle(),
    admin
      .from('structures')
      .select('id, name, email, city, type, is_active, created_at')
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: true }),
  ]);

  if (!organization) return null;

  const pointIds = (points || []).map((p) => p.id);
  const { data: staff } = pointIds.length
    ? await admin
        .from('users')
        .select('id, structure_id, role, first_name, last_name, email, is_active')
        .in('structure_id', pointIds)
    : { data: [] as any[] };

  const license = firstOf(organization.licenses as any);

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      email: organization.email,
      city: organization.city,
      modules: sanitizeModules(organization.modules),
    },
    license: license
      ? { ...license, isValid: isLicenseValid(license) }
      : null,
    points: (points || []).map((point) => {
      const pointStaff = (staff || []).filter((u) => u.structure_id === point.id);
      return {
        ...point,
        admins: pointStaff.filter((u) => u.role === 'ADMIN'),
        staffCount: pointStaff.length,
      };
    }),
  };
}

export async function getMyPoint(pointId: string) {
  const session = await requireOrgAdmin();
  if (!session) return null;

  const point = await getOwnedPoint(session.organizationId, pointId);
  if (!point) return null;

  const admin = getAdminSupabase();
  const { data: admins } = await admin
    .from('users')
    .select('id, first_name, last_name, email, is_active, created_at')
    .eq('structure_id', point.id)
    .eq('role', 'ADMIN')
    .order('created_at', { ascending: true });

  return { ...point, admins: admins || [] };
}

/** Crée un point et son administrateur. Le point hérite des modules de l'organisation. */
export async function createPoint(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireOrgAdmin();
  const { t } = await getT();
  if (!session) return { success: false, error: t('org.errors.unauthorized') };

  const point = parsePointFormData(formData, t);
  if ('error' in point) return { success: false, error: point.error };

  const account = parseAccountFormData(formData, 'admin', t);
  if ('error' in account) return { success: false, error: account.error };

  try {
    const admin = getAdminSupabase();

    const { data: organization } = await admin
      .from('organizations')
      .select('modules, licenses!organization_id(is_active, expires_at, max_points)')
      .eq('id', session.organizationId)
      .single();

    const license = firstOf(organization?.licenses as any) as
      | { is_active: boolean; expires_at: string | null; max_points: number | null }
      | null;

    if (!organization || !isLicenseValid(license)) {
      return { success: false, error: t('org.errors.licenseInactive') };
    }

    const { count: pointsCount } = await admin
      .from('structures')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', session.organizationId);

    const maxPoints = license?.max_points ?? 1;
    if ((pointsCount ?? 0) >= maxPoints) {
      return {
        success: false,
        error: t('org.errors.limitReached', { max: maxPoints }),
      };
    }

    if (await isPointEmailTaken(point.data.email)) {
      return { success: false, error: t('org.errors.pointEmailTaken') };
    }

    const { data: structure, error: structureError } = await admin
      .from('structures')
      .insert({
        organization_id: session.organizationId,
        name: point.data.name,
        email: point.data.email,
        city: point.data.city,
        type: point.data.type,
        phone: point.data.phone,
        address: point.data.address,
        modules: sanitizeModules(organization.modules),
        is_active: true,
        // Réglages par défaut du Cameroun (modifiables dans les paramètres du point).
        country: 'Cameroun',
        currency: 'XAF',
        timezone: 'Africa/Douala',
        tax_rate: CAMEROON_VAT_RATE,
      })
      .select('id')
      .single();

    if (structureError || !structure) {
      console.error('[createPoint] structure error:', structureError);
      return { success: false, error: t('org.errors.createFailed') };
    }

    const created = await insertUserAccount(account.data, {
      role: 'ADMIN',
      organizationId: session.organizationId,
      structureId: structure.id,
    });

    if ('error' in created) {
      await admin.from('structures').delete().eq('id', structure.id);
      return { success: false, error: created.error };
    }

    const locale = await getLocale();
    queueMail(() =>
      buildAccountCreatedMail({
        userId: created.user.id,
        email: created.user.email,
        firstName: account.data.firstName,
        role: 'ADMIN',
        scopeName: point.data.name,
        locale,
      })
    );

    revalidatePath('/organization', 'layout');
    return { success: true, error: '', pointId: structure.id };
  } catch (error) {
    console.error('[createPoint] error:', error);
    return { success: false, error: t('org.errors.createFailed') };
  }
}

export async function updatePoint(
  pointId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireOrgAdmin();
  const { t } = await getT();
  if (!session) return { success: false, error: t('org.errors.unauthorized') };

  if (!(await getOwnedPoint(session.organizationId, pointId))) {
    return { success: false, error: t('org.errors.notFound') };
  }

  const point = parsePointFormData(formData, t);
  if ('error' in point) return { success: false, error: point.error };

  if (await isPointEmailTaken(point.data.email, pointId)) {
    return { success: false, error: t('org.errors.pointEmailTaken') };
  }

  const admin = getAdminSupabase();
  const { error } = await admin
    .from('structures')
    .update({ ...point.data, updated_at: new Date().toISOString() })
    .eq('id', pointId)
    .eq('organization_id', session.organizationId);

  if (error) {
    console.error('[updatePoint] error:', error);
    return { success: false, error: t('org.errors.updateFailed') };
  }

  revalidatePath('/organization', 'layout');
  revalidatePath(`/organization/points/${pointId}`);
  return { success: true, error: '', pointId };
}

/** Un point désactivé bloque la connexion de tout son personnel et le retire du catalogue client. */
export async function setPointActive(pointId: string, isActive: boolean) {
  const session = await requireOrgAdmin();
  const { t } = await getT();
  if (!session) return { success: false, error: t('org.errors.unauthorized') };

  const point = await getOwnedPoint(session.organizationId, pointId);
  if (!point) return { success: false, error: t('org.errors.notFound') };

  const admin = getAdminSupabase();
  const { error } = await admin
    .from('structures')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', pointId)
    .eq('organization_id', session.organizationId);

  if (error) return { success: false, error: t('org.errors.updateFailed') };

  if ((point.is_active !== false) !== isActive) {
    queueMail(async () =>
      buildPointStatusMails({ recipients: await getPointAdminRecipients(pointId), pointName: point.name, isActive })
    );
  }

  revalidatePath('/organization', 'layout');
  revalidatePath(`/organization/points/${pointId}`);
  return { success: true, error: '' };
}

export async function addPointAdmin(
  pointId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireOrgAdmin();
  const { t } = await getT();
  if (!session) return { success: false, error: t('org.errors.unauthorized') };

  const point = await getOwnedPoint(session.organizationId, pointId);
  if (!point) {
    return { success: false, error: t('org.errors.notFound') };
  }

  const account = parseAccountFormData(formData, 'admin', t);
  if ('error' in account) return { success: false, error: account.error };

  const created = await insertUserAccount(account.data, {
    role: 'ADMIN',
    organizationId: session.organizationId,
    structureId: pointId,
  });
  if ('error' in created) return { success: false, error: created.error };

  const locale = await getLocale();
  queueMail(() =>
    buildAccountCreatedMail({
      userId: created.user.id,
      email: created.user.email,
      firstName: account.data.firstName,
      role: 'ADMIN',
      scopeName: point.name,
      locale,
    })
  );

  revalidatePath('/organization', 'layout');
  revalidatePath(`/organization/points/${pointId}`);
  return { success: true, error: '', pointId };
}

export async function setPointAdminActive(pointId: string, userId: string, isActive: boolean) {
  const session = await requireOrgAdmin();
  const { t } = await getT();
  if (!session) return { success: false, error: t('org.errors.unauthorized') };

  const point = await getOwnedPoint(session.organizationId, pointId);
  if (!point) {
    return { success: false, error: t('org.errors.notFound') };
  }

  const admin = getAdminSupabase();
  const { data: user, error } = await admin
    .from('users')
    .update({ is_active: isActive })
    .eq('id', userId)
    .eq('structure_id', pointId)
    .eq('role', 'ADMIN')
    .select('email, first_name')
    .maybeSingle();

  if (error) return { success: false, error: t('org.errors.adminUpdateFailed') };

  if (user) {
    queueMail(async () =>
      buildAccountStatusMail({
        email: user.email,
        firstName: user.first_name,
        isActive,
        scopeName: point.name,
        locale: await getUserLocale(userId),
      })
    );
  }

  revalidatePath(`/organization/points/${pointId}`);
  return { success: true, error: '' };
}
