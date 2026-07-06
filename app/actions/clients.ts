'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { requireAuth, requireModule } from './auth';
import { revalidatePath } from 'next/cache';

export async function getClients() {
  const session = await requireAuth();
  await requireModule('CRM');

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('clients')
    .select('*')
    .eq('structure_id', session.structureId!)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }

  return data;
}

export async function getClientById(id: string) {
  const session = await requireAuth();
  await requireModule('CRM');

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('structure_id', session.structureId!)
    .single();

  if (error) {
    console.error('Error fetching client:', error);
    return null;
  }

  return data;
}

export async function createClient(prevState: any, formData: FormData) {
  try {
    const session = await requireAuth();
    await requireModule('CRM');

    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const birthday = formData.get('birthday') as string;
    const allergies = formData.get('allergies') as string;
    const preferences = formData.get('preferences') as string;
    const notes = formData.get('notes') as string;

    if (!firstName || !lastName) {
      return { success: false, error: 'Le nom et le prénom sont obligatoires' };
    }

    const admin = getAdminSupabase();
    const { error } = await admin.from('clients').insert({
      structure_id: session.structureId!,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      email: email || null,
      birthday: birthday || null,
      allergies: allergies || null,
      preferences: preferences || null,
      notes: notes || null,
    });

    if (error) throw error;

    revalidatePath('/clients');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Error creating client:', error);
    return { success: false, error: error.message || 'Erreur lors de la création du client' };
  }
}

export async function updateClient(id: string, prevState: any, formData: FormData) {
  try {
    const session = await requireAuth();
    await requireModule('CRM');

    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const birthday = formData.get('birthday') as string;
    const allergies = formData.get('allergies') as string;
    const preferences = formData.get('preferences') as string;
    const notes = formData.get('notes') as string;

    if (!firstName || !lastName) {
      return { success: false, error: 'Le nom et le prénom sont obligatoires' };
    }

    const admin = getAdminSupabase();
    const { error } = await admin
      .from('clients')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email || null,
        birthday: birthday || null,
        allergies: allergies || null,
        preferences: preferences || null,
        notes: notes || null,
      })
      .eq('id', id)
      .eq('structure_id', session.structureId!);

    if (error) throw error;

    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Error updating client:', error);
    return { success: false, error: error.message || 'Erreur lors de la modification du client' };
  }
}

export async function deleteClient(id: string) {
  try {
    const session = await requireAuth();
    await requireModule('CRM');
    // Seuls l'admin ou le manager peuvent supprimer un client
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
      return { success: false, error: 'Non autorisé à supprimer un client' };
    }

    const admin = getAdminSupabase();
    const { error } = await admin
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('structure_id', session.structureId!);

    if (error) throw error;

    revalidatePath('/clients');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Error deleting client:', error);
    return { success: false, error: error.message || 'Erreur lors de la suppression' };
  }
}
