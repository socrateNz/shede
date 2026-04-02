'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

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
    return { success: false, error: 'Unauthorized' };
  }

  const number = String(formData.get('roomNumber') || '').trim();
  const type = String(formData.get('roomType') || '').trim();

  if (!number) {
    return { success: false, error: 'Room number is required' };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin.from('rooms').insert({
      structure_id: session.structureId,
      number,
      type,
      status: 'AVAILABLE'
    });

    if (error) {
      return { success: false, error: 'Failed to create room' };
    }

    revalidatePath('/rooms');
    return { success: true, error: '' };
  } catch (error) {
    return { success: false, error: 'Failed to create room' };
  }
}

export async function deleteRoom(roomId: string) {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('rooms')
      .delete()
      .eq('id', roomId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: 'Failed to delete room' };
    }

    revalidatePath('/rooms');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete room' };
  }
}

export async function updateRoomStatus(roomId: string, status: string) {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN', 'CAISSE', 'SERVEUR'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('rooms')
      .update({ status })
      .eq('id', roomId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: 'Failed to update status' };
    }

    revalidatePath('/rooms');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update status' };
  }
}

export async function updateRoom(
  roomId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || !session.structureId || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const number = String(formData.get('roomNumber') || '').trim();
  const type = String(formData.get('roomType') || '').trim();

  if (!number) {
    return { success: false, error: 'Room number is required' };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('rooms')
      .update({ number, type })
      .eq('id', roomId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: 'Failed to update room' };
    }

    revalidatePath('/rooms');
    return { success: true, error: '' };
  } catch (error) {
    return { success: false, error: 'Failed to update room' };
  }
}
