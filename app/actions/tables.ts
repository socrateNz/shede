'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { requireAuth, requireModule } from './auth';
import { revalidatePath } from 'next/cache';
import { te } from '@/lib/i18n/server';

export async function getTables() {
  const session = await requireAuth();
  await requireModule('TABLES');

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('tables')
    .select('*')
    .eq('structure_id', session.structureId!)
    .order('floor_name')
    .order('name');

  if (error) {
    console.error('Error fetching tables:', error);
    return [];
  }

  return data;
}

export async function createTable(formData: FormData) {
  try {
    const session = await requireAuth();
    await requireModule('TABLES');

    const name = formData.get('name') as string;
    const capacity = parseInt(formData.get('capacity') as string) || 2;
    const shape = (formData.get('shape') as string) || 'rectangle';
    const floor_id = formData.get('floor_id') as string;

    if (!name) {
      return { success: false, error: await te('errors.tableNameRequired') };
    }
    if (!floor_id) {
      return { success: false, error: await te('errors.floorRequired') };
    }

    const admin = getAdminSupabase();

    // La salle doit appartenir à la structure de l'appelant (garde anti-IDOR)
    const { data: floor } = await admin
      .from('floors')
      .select('id, name')
      .eq('id', floor_id)
      .eq('structure_id', session.structureId!)
      .single();

    if (!floor) {
      return { success: false, error: await te('errors.floorNotFound') };
    }

    // Vérifier que le nom de la table est unique pour cette structure
    const { data: existingTable } = await admin
      .from('tables')
      .select('id')
      .eq('structure_id', session.structureId!)
      .ilike('name', name) // Recherche insensible à la casse
      .single();

    if (existingTable) {
      return { success: false, error: await te('errors.tableExists', { name }) };
    }

    const { error } = await admin.from('tables').insert({
      structure_id: session.structureId!,
      name,
      capacity,
      shape,
      floor_id: floor.id,
      floor_name: floor.name,
      position_x: 50,
      position_y: 50,
      width: shape === 'rectangle' ? 120 : 80,
      height: 80,
    });

    if (error) throw error;

    revalidatePath('/floor-manager');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Error creating table:', error);
    return { success: false, error: await te('errors.tableCreateFailed') };
  }
}

export async function updateTable(id: string, formData: FormData) {
  try {
    const session = await requireAuth();
    await requireModule('TABLES');

    const name = formData.get('name') as string;
    const capacity = parseInt(formData.get('capacity') as string) || 2;
    const shape = (formData.get('shape') as string) || 'rectangle';

    if (!name) {
      return { success: false, error: await te('errors.tableNameRequired') };
    }

    const admin = getAdminSupabase();

    // Vérifier que le nom de la table est unique pour cette structure (hors elle-même)
    const { data: existingTable } = await admin
      .from('tables')
      .select('id')
      .eq('structure_id', session.structureId!)
      .ilike('name', name)
      .neq('id', id)
      .single();

    if (existingTable) {
      return { success: false, error: await te('errors.tableExists', { name }) };
    }

    const { data, error } = await admin
      .from('tables')
      .update({
        name,
        capacity,
        shape,
        width: shape === 'rectangle' ? 120 : 80,
        height: 80,
      })
      .eq('id', id)
      .eq('structure_id', session.structureId!)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/floor-manager');
    return { success: true, table: data };
  } catch (error: any) {
    console.error('Error updating table:', error);
    return { success: false, error: await te('errors.tableUpdateFailed') };
  }
}

export async function updateTablePosition(id: string, x: number, y: number) {
  try {
    const session = await requireAuth();
    await requireModule('TABLES');

    const admin = getAdminSupabase();
    const { error } = await admin
      .from('tables')
      .update({ position_x: x, position_y: y })
      .eq('id', id)
      .eq('structure_id', session.structureId!);

    if (error) throw error;

    revalidatePath('/floor-manager');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Error updating table position:', error);
    return { success: false, error: await te('errors.tableUpdateFailed') };
  }
}

export async function deleteTable(id: string) {
  try {
    const session = await requireAuth();
    await requireModule('TABLES');
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
      return { success: false, error: await te('errors.tableDeleteForbidden') };
    }

    const admin = getAdminSupabase();
    const { error } = await admin
      .from('tables')
      .delete()
      .eq('id', id)
      .eq('structure_id', session.structureId!);

    if (error) throw error;

    revalidatePath('/floor-manager');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Error deleting table:', error);
    return { success: false, error: await te('errors.tableDeleteFailed') };
  }
}
