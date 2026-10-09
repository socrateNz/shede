'use server';

import { createSession, deleteSession, getSession, verifyPassword } from '@/lib/auth';
export { getSession }; // Allow client components to import this server-side function indirectly if needed via 'use server'
import { getAdminSupabase } from '@/lib/supabase';
import { ACCESS_ERROR_KEYS, checkAccountAccess } from '@/lib/account-access';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';

function getHomeForRole(role: string) {
  if (role === 'SUPER_ADMIN') return '/structures';
  if (role === 'ORG_ADMIN') return '/organization';
  if (role === 'CLIENT') return '/client';
  return '/dashboard';
}

export async function login(
  _prevState: { success: boolean; error: string; redirect?: string },
  formData: FormData
) {
  const { t } = await getT();
  try {
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    if (!email || !password) {
      return { success: false, error: t('auth.errors.missingCredentials') };
    }

    const admin = getAdminSupabase();

    // Get user from database
    const { data: users, error } = await admin
      .from('users')
      .select('*, structures(id, modules, organization_id), organizations(id, modules)')
      .eq('email', email)
      .single();

    if (error || !users) {
      return { success: false, error: t('auth.errors.invalidCredentials') };
    }

    // Verify password
    const isValid = await verifyPassword(password, users.password_hash);
    if (!isValid) {
      return { success: false, error: t('auth.errors.invalidCredentials') };
    }

    // Check if user is active
    if (!users.is_active) {
      return { success: false, error: t('auth.errors.accountInactive') };
    }

    const organizationId: string | null =
      users.organization_id ?? users.structures?.organization_id ?? null;

    const access = await checkAccountAccess(users.structure_id, organizationId);
    if (!access.ok) {
      return { success: false, error: t(ACCESS_ERROR_KEYS[access.reason]) };
    }

    // Les modules viennent de la licence de l'organisation ; structures.modules
    // en est une copie synchronisée (repli pour les données non migrées).
    const modules: string[] =
      users.organizations?.modules || users.structures?.modules || [];

    await createSession({
      userId: users.id,
      email: users.email,
      role: users.role,
      structureId: users.structure_id ?? undefined,
      organizationId: organizationId ?? undefined,
      modules,
      licenseActive: organizationId ? true : undefined,
    });

    return {
      success: true,
      error: '',
      redirect: getHomeForRole(users.role),
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: t('auth.errors.loginFailed') };
  }
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const admin = getAdminSupabase();
    const { data: user } = await admin
      .from('users')
      .select('*, structures(modules)')
      .eq('id', session.userId)
      .single();

    return user;
  } catch (error) {
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const access = await checkAccountAccess(session.structureId, session.organizationId);
  if (!access.ok) {
    redirect(`/login?error=${access.reason}`);
  }

  return session;
}

export async function requireRole(...roles: string[]) {
  const session = await requireAuth();
  if (!session.role || !roles.includes(session.role as string)) {
    redirect('/unauthorized');
  }
  return session;
}

export async function requireModule(moduleName: string) {
  const session = await requireAuth();
  
  // SUPER_ADMIN has access to everything
  if (session.role === 'SUPER_ADMIN') return session;

  if (!session.modules || !session.modules.includes(moduleName)) {
    redirect('/unauthorized?error=module_required&module=' + moduleName);
  }
  return session;
}

export async function getSessionAction() {
  return await getSession();
}
