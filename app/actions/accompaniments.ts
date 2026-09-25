'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { te } from '@/lib/i18n/server';

export async function getAccompaniments() {
  const session = await getSession();
  if (!session || !['ADMIN'].includes(session.role)) {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('accompaniments')
      .select('*')
      .eq('structure_id', session.structureId)
      .eq('is_deleted', false)
      .order('name', { ascending: true });

    return data || [];
  } catch (error) {
    return [];
  }
}

export async function createAccompaniment(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || !['ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  const name = String(formData.get('name') || '').trim();
  const price = Number(formData.get('price') || 0);

  if (!name || Number.isNaN(price) || price < 0) {
    return { success: false, error: await te('errors.nameAndPriceRequired') };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin.from('accompaniments').insert({
      structure_id: session.structureId,
      name,
      price,
      is_available: true,
      is_deleted: false
    });

    if (error) return { success: false, error: await te('errors.createFailed') };
    
    revalidatePath('/accompaniments');
    return { success: true, error: '' };
  } catch (error) {
    return { success: false, error: await te('errors.createFailed') };
  }
}

export async function updateAccompaniment(id: string, name: string, price: number, isAvailable: boolean) {
  const session = await getSession();
  if (!session || !['ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  if (!name || Number.isNaN(price) || price < 0) {
    return { success: false, error: await te('errors.nameAndPriceRequired') };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('accompaniments')
      .update({ name, price, is_available: isAvailable })
      .eq('id', id)
      .eq('structure_id', session.structureId);

    if (error) return { success: false, error: await te('errors.updateFailed') };

    revalidatePath('/accompaniments');
    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.updateFailed') };
  }
}

export async function deleteAccompaniment(id: string) {
  const session = await getSession();
  if (!session || !['ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('accompaniments')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('structure_id', session.structureId);

    if (error) return { success: false, error: await te('errors.deleteFailed') };

    revalidatePath('/accompaniments');
    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.deleteFailed') };
  }
}
