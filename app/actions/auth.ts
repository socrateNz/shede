'use server';

import { createSession, deleteSession, getSession, hashPassword, verifyPassword } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import type { User } from '@/lib/supabase';
import { redirect } from 'next/navigation';

async function isStructureLicenseActive(structureId: string | null | undefined) {
  if (!structureId) return true; // B2C clients have no structure
  const admin = getAdminSupabase();
  const { data: license } = await admin
    .from('licenses')
    .select('is_active, expires_at')
    .eq('structure_id', structureId)
    .single();

  const isExpired = Boolean(
    license?.expires_at && new Date(license.expires_at).getTime() < Date.now()
  );

  return Boolean(license && license.is_active && !isExpired);
}

export async function login(
  _prevState: { success: boolean; error: string; redirect?: string },
  formData: FormData
) {
  try {
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    const admin = getAdminSupabase();

    // Get user from database
    const { data: users, error } = await admin
      .from('users')
      .select('*, structures(*)')
      .eq('email', email)
      .single();

    if (error || !users) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Verify password
    const isValid = await verifyPassword(password, users.password_hash);
    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Check if user is active
    if (!users.is_active) {
      return { success: false, error: 'User account is inactive' };
    }

    const licenseActive = await isStructureLicenseActive(users.structure_id);
    if (!licenseActive) {
      return {
        success: false,
        error: 'Votre licence a expiré, veuillez contacter le support.',
      };
    }

    // Create session
    await createSession({
      userId: users.id,
      email: users.email,
      role: users.role,
      structureId: users.structure_id,
    });

    return { 
      success: true, 
      error: '', 
      redirect: users.role === 'SUPER_ADMIN' ? '/structures' : users.role === 'CLIENT' ? '/client' : '/dashboard' 
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}

export async function register(
  _prevState: { success: boolean; error: string; redirect?: string },
  formData: FormData
) {
  try {
    const structureName = String(formData.get('structureName') || '').trim();
    const structureEmail = String(formData.get('structureEmail') || '').trim().toLowerCase();
    const city = String(formData.get('city') || '').trim();
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    if (!structureName || !email || !password) {
      return { success: false, error: 'Veuillez remplir les informations obligatoires.' };
    }

    const admin = getAdminSupabase();

    // Create structure
    const { data: structure, error: structureError } = await admin
      .from('structures')
      .insert({
        name: structureName,
        email: structureEmail,
        city: city || null,
      })
      .select()
      .single();

    if (structureError || !structure) {
      return { success: false, error: 'Failed to create structure' };
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const { data: user, error: userError } = await admin
      .from('users')
      .insert({
        structure_id: structure.id,
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: 'ADMIN', // First user is admin
        is_active: true,
      })
      .select()
      .single();

    if (userError || !user) {
      // Clean up structure if user creation fails
      await admin.from('structures').delete().eq('id', structure.id);
      return { success: false, error: 'Failed to create user' };
    }

    // Create license for structure
    await admin.from('licenses').insert({
      structure_id: structure.id,
      plan: 'FREE',
      max_users: 5,
      max_tables: 10,
      is_active: true,
    });

    // Create session
    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      structureId: structure.id,
    });

    return { success: true, error: '', redirect: '/setup/products' };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, error: 'Registration failed' };
  }
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
      .select()
      .eq('id', session.userId)
      .single();

    return user as User | null;
  } catch (error) {
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (session.structureId) {
    const licenseActive = await isStructureLicenseActive(session.structureId);
    if (!licenseActive) {
      redirect('/login?error=license_expired');
    }
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
