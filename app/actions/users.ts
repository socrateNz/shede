'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';
import { notifyUser } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';
import { buildAccountCreatedMail, buildAccountStatusMail, buildRoleChangedMail, getUserLocale, queueMail } from '@/lib/emails';
import { getLocale, te } from '@/lib/i18n/server';
import { buildMeta, emptyPage, pageRange, searchTerm, settlePage, type Paginated } from '@/lib/pagination';
import type { User } from '@/lib/supabase';
import { TEAM_ROLES } from '@/lib/roles';

async function getStructureName(structureId: string | undefined) {
  if (!structureId) return null;
  const { data } = await getAdminSupabase().from('structures').select('name').eq('id', structureId).maybeSingle();
  return data?.name ?? null;
}

/** Rôles attribuables par l'administrateur d'un point (jamais ORG_ADMIN / SUPER_ADMIN / CLIENT). */
const POINT_ASSIGNABLE_ROLES = [
  'ADMIN',
  'MANAGER',
  'CAISSE',
  'SERVEUR',
  'RECEPTION',
  'CUISINIER',
  'BAR',
  'LIVREUR',
  'COMPTABLE',
  'MAGASINIER',
  'RH',
];

export async function createUser(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const email = String(formData.get('email') || '').trim();
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  const password = String(formData.get('password') || '');
  const role = String(formData.get('role') || '').trim();

  if (!email || !firstName || !lastName || !password || !role) {
    return { success: false, error: await te('errors.requiredFields') };
  }

  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  if (!POINT_ASSIGNABLE_ROLES.includes(role)) {
    return { success: false, error: await te('errors.invalidRole') };
  }

  try {
    const admin = getAdminSupabase();

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const { data: user, error } = await admin
      .from('users')
      .insert({
        structure_id: session.structureId,
        organization_id: session.organizationId ?? null,
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role,
        is_active: true,
      })
      .select()
      .single();

    if (error || !user) {
      if (error?.message.includes('duplicate')) {
        return { success: false, error: await te('errors.emailExists') };
      }
      return { success: false, error: await te('errors.userCreateFailed') };
    }

    const locale = await getLocale();
    queueMail(async () =>
      buildAccountCreatedMail({
        userId: user.id,
        email: user.email,
        firstName,
        role,
        scopeName: await getStructureName(session.structureId),
        locale,
      })
    );

    // Notify new user
    await notifyUser({
      userId: user.id,
      structureId: session.structureId!,
      message: ({ t }) => ({
        title: t('notify.welcome.title'),
        body: t('notify.welcome.body', { role: t(`roles.${role as 'ADMIN'}`) }),
      }),
      url: '/dashboard',
    });

    revalidatePath('/users');
    revalidatePath('/dashboard');
    return { success: true, userId: user.id };
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, error: await te('errors.userCreateFailed') };
  }
}

export async function updateUser(
  userId: string,
  firstName: string,
  lastName: string,
  role: string,
  isActive: boolean
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  if (!POINT_ASSIGNABLE_ROLES.includes(role)) {
    return { success: false, error: await te('errors.invalidRole') };
  }

  try {
    const admin = getAdminSupabase();

    const { data: previous } = await admin
      .from('users')
      .select('email, role, is_active')
      .eq('id', userId)
      .eq('structure_id', session.structureId)
      .maybeSingle();

    const { error } = await admin
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        role,
        is_active: isActive,
      })
      .eq('id', userId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: await te('errors.userUpdateFailed') };
    }

    if (previous && previous.is_active !== isActive) {
      queueMail(async () =>
        buildAccountStatusMail({
          email: previous.email,
          firstName,
          isActive,
          scopeName: await getStructureName(session.structureId),
          locale: await getUserLocale(userId),
        })
      );
    } else if (previous && isActive && previous.role !== role) {
      queueMail(async () =>
        buildRoleChangedMail({
          email: previous.email,
          firstName,
          previousRole: previous.role,
          role,
          scopeName: await getStructureName(session.structureId),
          locale: await getUserLocale(userId),
        })
      );
    }

    // Notify user of change
    await notifyUser({
      userId: userId,
      structureId: session.structureId!,
      message: ({ t }) => ({
        title: t('notify.profileUpdated.title'),
        body: t('notify.profileUpdated.body', { role: t(`roles.${role as 'ADMIN'}`) }),
      }),
      url: '/profile',
    });

    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, error: await te('errors.userUpdateFailed') };
  }
}

export async function deleteUser(userId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  // Prevent deleting self
  if (userId === session.userId) {
    return { success: false, error: await te('errors.cannotDeleteSelf') };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: await te('errors.userDeleteFailed') };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, error: await te('errors.userDeleteFailed') };
  }
}

export type UserListStats = { total: number; admins: number; reception: number; staff: number };
export type UserRow = Omit<User, 'password_hash'>;

/** Colonnes affichables d'un compte (jamais l'empreinte du mot de passe). */
const USER_COLUMNS = 'id, structure_id, organization_id, email, first_name, last_name, role, is_active, created_at, updated_at';

/** Équipe du point de la session, 20 par page, recherche nom/e-mail et filtre par rôle ; statistiques en SQL. */
export async function listUsers(filters: { page?: number; q?: string; role?: string | null } = {}): Promise<Paginated<UserRow, UserListStats>> {
  const empty: UserListStats = { total: 0, admins: 0, reception: 0, staff: 0 };
  const session = await getSession();
  const page = Math.max(1, filters.page ?? 1);
  if (!session?.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const q = searchTerm(filters.q);

  let query = admin
    .from('users')
    .select(USER_COLUMNS, { count: 'exact' })
    .eq('structure_id', session.structureId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (filters.role && (TEAM_ROLES as string[]).includes(filters.role)) query = query.eq('role', filters.role);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);

  const [{ data, count, error }, statsRes] = await Promise.all([settlePage(query), admin.rpc('user_list_stats', { p_structure_id: session.structureId })]);
  if (error) console.error('[listUsers] Error:', error);
  const raw = (statsRes.data ?? empty) as UserListStats;
  const stats: UserListStats = { total: Number(raw.total) || 0, admins: Number(raw.admins) || 0, reception: Number(raw.reception) || 0, staff: Number(raw.staff) || 0 };
  return { items: (data ?? []) as UserRow[], meta: buildMeta(page, count ?? 0, stats) };
}
