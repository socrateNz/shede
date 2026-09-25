'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
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
