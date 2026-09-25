'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';
import { notifyUser } from '@/app/actions/push';
import { revalidatePath } from 'next/cache';
import { buildAccountCreatedMail, buildAccountStatusMail, buildRoleChangedMail, queueMail } from '@/lib/emails';

async function getStructureName(structureId: string | undefined) {
  if (!structureId) return 'votre établissement';
  const { data } = await getAdminSupabase().from('structures').select('name').eq('id', structureId).maybeSingle();
  return data?.name ?? 'votre établissement';
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
    return { success: false, error: 'All required fields must be provided' };
  }

  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!POINT_ASSIGNABLE_ROLES.includes(role)) {
    return { success: false, error: 'Invalid role' };
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
        return { success: false, error: 'Email already exists' };
      }
      return { success: false, error: 'Failed to create user' };
    }

    queueMail(async () =>
      buildAccountCreatedMail({
        userId: user.id,
        email: user.email,
        firstName,
        role,
        scopeName: await getStructureName(session.structureId),
      })
    );

    // Notify new user
    await notifyUser({
      userId: user.id,
      structureId: session.structureId!,
      title: 'Bienvenue dans l\'équipe !',
      body: `Votre compte en tant que ${role} a été créé avec succès.`,
      url: '/dashboard',
    });

    revalidatePath('/users');
    revalidatePath('/dashboard');
    return { success: true, userId: user.id };
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, error: 'Failed to create user' };
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
    return { success: false, error: 'Unauthorized' };
  }

  if (!POINT_ASSIGNABLE_ROLES.includes(role)) {
    return { success: false, error: 'Invalid role' };
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
      return { success: false, error: 'Failed to update user' };
    }

    if (previous && previous.is_active !== isActive) {
      queueMail(async () =>
        buildAccountStatusMail({
          email: previous.email,
          firstName,
          isActive,
          scopeName: await getStructureName(session.structureId),
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
        })
      );
    }

    // Notify user of change
    await notifyUser({
      userId: userId,
      structureId: session.structureId!,
      title: 'Mise à jour de profil',
      body: `Votre profil ou votre rôle (${role}) a été mis à jour par l'administrateur.`,
      url: '/profile',
    });

    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, error: 'Failed to update user' };
  }
}

export async function deleteUser(userId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Prevent deleting self
  if (userId === session.userId) {
    return { success: false, error: 'Cannot delete your own account' };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: 'Failed to delete user' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, error: 'Failed to delete user' };
  }
}

export async function getUsers(structureId: string) {
  try {
    const admin = getAdminSupabase();

    const { data: users, error } = await admin
      .from('users')
      .select('*')
      .eq('structure_id', structureId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return users || [];
  } catch (error) {
    return [];
  }
}
