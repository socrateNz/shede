'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { buildMeta, emptyPage, pageRange, settlePage, type Paginated } from '@/lib/pagination';
import { revalidatePath } from 'next/cache';
import { te } from '@/lib/i18n/server';
import { emitMenuUpdated } from '@/lib/api/webhooks';

export type AccompanimentListStats = { total: number; available: number; totalPrice: number };

/** Accompagnements du point, 20 par page (ordre alphabétique) ; statistiques en SQL. */
export async function listAccompaniments(filters: { page?: number } = {}): Promise<Paginated<any, AccompanimentListStats>> {
  const empty: AccompanimentListStats = { total: 0, available: 0, totalPrice: 0 };
  const page = Math.max(1, filters.page ?? 1);
  const session = await getSession();
  if (!session?.structureId || session.role !== 'ADMIN') return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const [{ data, count }, statsRes] = await Promise.all([
    settlePage(admin
      .from('accompaniments')
      .select('*', { count: 'exact' })
      .eq('structure_id', session.structureId)
      .eq('is_deleted', false)
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)),
    admin.rpc('accompaniment_list_stats', { p_structure_id: session.structureId }),
  ]);
  const raw = (statsRes.data ?? empty) as AccompanimentListStats;
  const stats: AccompanimentListStats = { total: Number(raw.total) || 0, available: Number(raw.available) || 0, totalPrice: Number(raw.totalPrice) || 0 };
  return { items: data ?? [], meta: buildMeta(page, count ?? 0, stats) };
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
    await emitMenuUpdated(session.structureId as string, { accompaniment_id: id, change: 'updated', is_available: isAvailable });
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
    await emitMenuUpdated(session.structureId as string, { accompaniment_id: id, change: 'deleted' });
    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.deleteFailed') };
  }
}
