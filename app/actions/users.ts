'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';
import { notifyUser } from '@/app/actions/push';
import { revalidatePath } from 'next/cache';

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

  try {
    const admin = getAdminSupabase();

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const { data: user, error } = await admin
      .from('users')
      .insert({
        structure_id: session.structureId,
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

  try {
    const admin = getAdminSupabase();

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
