'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { requireAuth, requireModule } from './auth';
import { revalidatePath } from 'next/cache';

export async function getFloors() {
  const session = await requireAuth();
  await requireModule('TABLES');

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('floors')
    .select('*')
    .eq('structure_id', session.structureId!)
    .order('name');

  if (error) {
    console.error('Error fetching floors:', error);
    return [];
  }

  if (data && data.length > 0) {
    return data;
  }

  // Auto-guérison : toute structure avec le module TABLES doit avoir au moins une salle.
  const { data: seeded, error: seedError } = await admin
    .from('floors')
    .insert({ structure_id: session.structureId!, name: 'Salle principale' })
    .select()
    .single();

  if (seedError) {
    // Course entre deux chargements concurrents : l'un des deux a déjà créé la salle,
    // on retombe simplement sur une lecture au lieu d'échouer.
    const { data: retry } = await admin
      .from('floors')
      .select('*')
      .eq('structure_id', session.structureId!)
      .order('name');
    return retry || [];
  }

  return [seeded];
}

export async function createFloor(name: string) {
  try {
    const session = await requireAuth();
    await requireModule('TABLES');

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Le nom de la salle est obligatoire' };
    }

    const admin = getAdminSupabase();

    const { data: existing } = await admin
      .from('floors')
      .select('id')
      .eq('structure_id', session.structureId!)
      .ilike('name', trimmedName)
      .single();

    if (existing) {
      return { success: false, error: `Une salle nommée "${trimmedName}" existe déjà.` };
    }

    const { data, error } = await admin
      .from('floors')
      .insert({ structure_id: session.structureId!, name: trimmedName })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: `Une salle nommée "${trimmedName}" existe déjà.` };
      }
      throw error;
    }

    revalidatePath('/floor-manager');
    return { success: true, floor: data };
  } catch (error: any) {
    console.error('Error creating floor:', error);
    return { success: false, error: error.message || 'Erreur lors de la création de la salle' };
  }
}

export async function renameFloor(id: string, name: string) {
  try {
    const session = await requireAuth();
    await requireModule('TABLES');

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Le nom de la salle est obligatoire' };
    }

    const admin = getAdminSupabase();

    const { data: existing } = await admin
      .from('floors')
      .select('id')
      .eq('structure_id', session.structureId!)
      .ilike('name', trimmedName)
      .neq('id', id)
      .single();

    if (existing) {
      return { success: false, error: `Une salle nommée "${trimmedName}" existe déjà.` };
    }

    const { data, error } = await admin
      .from('floors')
      .update({ name: trimmedName })
      .eq('id', id)
      .eq('structure_id', session.structureId!)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: `Une salle nommée "${trimmedName}" existe déjà.` };
      }
      throw error;
    }

    // Garde la colonne dénormalisée tables.floor_name synchronisée pour les
    // écrans qui la lisent directement (commandes, etc.)
    await admin
      .from('tables')
      .update({ floor_name: trimmedName })
      .eq('floor_id', id)
      .eq('structure_id', session.structureId!);

    revalidatePath('/floor-manager');
    return { success: true, floor: data };
  } catch (error: any) {
    console.error('Error renaming floor:', error);
    return { success: false, error: error.message || 'Erreur lors du renommage de la salle' };
  }
}

export async function deleteFloor(id: string) {
  try {
    const session = await requireAuth();
    await requireModule('TABLES');
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
      return { success: false, error: 'Non autorisé à supprimer une salle' };
    }

    const admin = getAdminSupabase();

    const { count } = await admin
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('floor_id', id)
      .eq('structure_id', session.structureId!);

    if (count && count > 0) {
      return {
        success: false,
        error: `Déplacez ou supprimez les ${count} table(s) de cette salle avant de la supprimer.`,
      };
    }

    const { error } = await admin
      .from('floors')
      .delete()
      .eq('id', id)
      .eq('structure_id', session.structureId!);

    if (error) throw error;

    revalidatePath('/floor-manager');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Error deleting floor:', error);
    return { success: false, error: error.message || 'Erreur lors de la suppression de la salle' };
  }
}
