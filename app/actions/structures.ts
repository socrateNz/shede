'use server';

import { getSession, hashPassword } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function getAllStructures() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from('structures')
      .select('id, name, email, created_at, licenses(is_active, expires_at, plan, max_users, max_tables)')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
}

export async function createStructureWithAdmin(
  _prevState: { success: boolean; error: string; structureId?: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const structureName = String(formData.get('structureName') || '').trim();
  const structureEmail = String(formData.get('structureEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();
  const adminFirstName = String(formData.get('adminFirstName') || '').trim();
  const adminLastName = String(formData.get('adminLastName') || '').trim();
  const adminEmail = String(formData.get('adminEmail') || '').trim().toLowerCase();
  const adminPassword = String(formData.get('adminPassword') || '');
  const type = String(formData.get('structureType') || 'RESTAURANT');
  const modules = formData.getAll('modules').map(String);

  if (!structureName || !structureEmail || !adminFirstName || !adminLastName || !adminEmail || !adminPassword) {
    return { success: false, error: 'All fields are required' };
  }

  if (adminPassword.length < 8) {
    return { success: false, error: 'Admin password must be at least 8 characters' };
  }

  try {
    const admin = getAdminSupabase();

    const { data: structure, error: structureError } = await admin
      .from('structures')
      .insert({
        name: structureName,
        email: structureEmail,
        city: city || null,
        type: type,
        modules: modules.length > 0 ? modules : ['POS'],
      })
      .select('id')
      .single();

    if (structureError || !structure) {
      return { success: false, error: 'Failed to create structure' };
    }

    const passwordHash = await hashPassword(adminPassword);

    const { error: userError } = await admin
      .from('users')
      .insert({
        structure_id: structure.id,
        email: adminEmail,
        password_hash: passwordHash,
        first_name: adminFirstName,
        last_name: adminLastName,
        role: 'ADMIN',
        is_active: true,
      });

    if (userError) {
      await admin.from('structures').delete().eq('id', structure.id);
      return { success: false, error: 'Failed to create structure admin' };
    }

    await admin.from('licenses').insert({
      structure_id: structure.id,
      plan: 'FREE',
      max_users: 5,
      max_tables: 10,
      is_active: true,
    });

    return { success: true, error: '', structureId: structure.id };
  } catch (error) {
    return { success: false, error: 'Failed to create structure' };
  }
}

export async function updateStructureLicense(
  structureId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const isActive = String(formData.get('isActive') || 'false') === 'true';
  const expiresAtRaw = String(formData.get('expiresAt') || '').trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('licenses')
      .update({
        is_active: isActive,
        expires_at: expiresAt,
      })
      .eq('structure_id', structureId);

    if (error) {
      return { success: false, error: 'Failed to update license' };
    }

    revalidatePath('/structures');
    return { success: true, error: '' };
  } catch (error) {
    return { success: false, error: 'Failed to update license' };
  }
}

export async function updateStructure(
  structureId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const name = String(formData.get('structureName') || '').trim();
  const email = String(formData.get('structureEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();
  const type = String(formData.get('structureType') || '');
  const modules = formData.getAll('modules').map(String);

  if (!name || !email) {
    return { success: false, error: 'Name and email are required' };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('structures')
      .update({
        name,
        email,
        ...(city ? { city } : {}),
        ...(type ? { type } : {}),
        ...(modules.length > 0 ? { modules } : {}),
      })
      .eq('id', structureId);

    if (error) {
      console.error('Structure Update Error:', error);
      return { success: false, error: error.message || 'Failed to update structure' };
    }

    revalidatePath('/structures');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Structure Update Catch Error:', error);
    return { success: false, error: error.message || 'Failed to update structure' };
  }
}

export async function deleteStructure(structureId: string) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();
    // This assumes cascading deletes are configured via foreign keys for related items (users, rooms, orders, etc.)
    const { error } = await admin
      .from('structures')
      .delete()
      .eq('id', structureId);

    if (error) {
      return { success: false, error: 'Failed to delete structure' };
    }

    revalidatePath('/structures');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete structure' };
  }
}
