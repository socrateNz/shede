'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { buildMeta, emptyPage, pageRange, searchTerm, settlePage, type Paginated } from '@/lib/pagination';
import { revalidatePath } from 'next/cache';
import { te } from '@/lib/i18n/server';

export async function getRooms() {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('rooms')
      .select('*')
      .eq('structure_id', session.structureId)
      .order('number', { ascending: true });

    return data || [];
  } catch (error) {
    return [];
  }
}

export type RoomListStats = { total: number; available: number; occupied: number; cleaning: number };
const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'CLEANING'];

/** Chambres du point, 20 par page (par numéro), recherche par numéro et filtre par état ; statistiques en SQL. */
export async function listRooms(filters: { page?: number; q?: string; status?: string | null } = {}): Promise<Paginated<any, RoomListStats>> {
  const empty: RoomListStats = { total: 0, available: 0, occupied: 0, cleaning: 0 };
  const session = await getSession();
  const page = Math.max(1, filters.page ?? 1);
  if (!session?.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const q = searchTerm(filters.q);

  let query = admin
    .from('rooms')
    .select('*', { count: 'exact' })
    .eq('structure_id', session.structureId)
    .order('number', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to);
  if (filters.status && ROOM_STATUSES.includes(filters.status)) query = query.eq('status', filters.status);
  if (q) query = query.ilike('number', `%${q}%`);

  const [{ data, count, error }, statsRes] = await Promise.all([settlePage(query), admin.rpc('room_list_stats', { p_structure_id: session.structureId })]);
  if (error) console.error('[listRooms] Error:', error);
  const raw = (statsRes.data ?? empty) as RoomListStats;
  const stats: RoomListStats = { total: Number(raw.total) || 0, available: Number(raw.available) || 0, occupied: Number(raw.occupied) || 0, cleaning: Number(raw.cleaning) || 0 };
  return { items: data ?? [], meta: buildMeta(page, count ?? 0, stats) };
}

export async function createRoom(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  const number = String(formData.get('roomNumber') || '').trim();
  const type = String(formData.get('roomType') || '').trim();
  const priceRaw = String(formData.get('price') || '0').trim();
  const price = isNaN(parseFloat(priceRaw)) ? 0 : parseFloat(priceRaw);

  const image1 = String(formData.get('image1') || '').trim();
  const image2 = String(formData.get('image2') || '').trim();
  const images = [image1, image2].filter(Boolean);

  if (!number) {
    return { success: false, error: await te('errors.roomNumberRequired') };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin.from('rooms').insert({
      structure_id: session.structureId,
      number,
      type,
      price,
      status: 'AVAILABLE',
      ...(images.length > 0 ? { images } : {})
    });

    if (error) {
      return { success: false, error: await te('errors.roomCreateFailed') };
    }

    revalidatePath('/rooms');
    return { success: true, error: '' };
  } catch (error) {
    return { success: false, error: await te('errors.roomCreateFailed') };
  }
}

export async function deleteRoom(roomId: string) {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('rooms')
      .delete()
      .eq('id', roomId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: await te('errors.roomDeleteFailed') };
    }

    revalidatePath('/rooms');
    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.roomDeleteFailed') };
  }
}

export async function updateRoomStatus(roomId: string, status: string) {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN', 'CAISSE', 'SERVEUR'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('rooms')
      .update({ status })
      .eq('id', roomId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: await te('errors.statusUpdateFailed') };
    }

    revalidatePath('/rooms');
    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.statusUpdateFailed') };
  }
}

export async function updateRoom(
  roomId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  const number = String(formData.get('roomNumber') || '').trim();
  const type = String(formData.get('roomType') || '').trim();
  const priceRaw = String(formData.get('price') || '0').trim();
  const price = isNaN(parseFloat(priceRaw)) ? 0 : parseFloat(priceRaw);
  
  const image1 = String(formData.get('image1') || '').trim();
  const image2 = String(formData.get('image2') || '').trim();
  const images = [image1, image2].filter(Boolean);

  if (!number) {
    return { success: false, error: await te('errors.roomNumberRequired') };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('rooms')
      .update({ number, type, price, ...(images.length > 0 ? { images } : { images: null }) })
      .eq('id', roomId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: await te('errors.roomUpdateFailed') };
    }

    revalidatePath('/rooms');
    return { success: true, error: '' };
  } catch (error) {
    return { success: false, error: await te('errors.roomUpdateFailed') };
  }
}
