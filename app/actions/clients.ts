'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { requireAuth, requireModule } from './auth';
import { revalidatePath } from 'next/cache';
import { te } from '@/lib/i18n/server';
import { buildMeta, pageRange, searchTerm, settlePage, type Paginated } from '@/lib/pagination';

export type ClientListStats = { total: number; newThisMonth: number };

/** Fichier clients du point, 20 par page (les plus récents d'abord), recherche nom/téléphone/e-mail ; statistiques en SQL. */
export async function listClients(filters: { page?: number; q?: string } = {}): Promise<Paginated<any, ClientListStats>> {
  const session = await requireAuth();
  await requireModule('CRM');
  const page = Math.max(1, filters.page ?? 1);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const q = searchTerm(filters.q);

  let query = admin
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('structure_id', session.structureId!)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);

  const [{ data, count, error }, statsRes] = await Promise.all([settlePage(query), admin.rpc('client_list_stats', { p_structure_id: session.structureId! })]);
  if (error) console.error('Error fetching clients:', error);
  const raw = (statsRes.data ?? {}) as Partial<ClientListStats>;
  const stats: ClientListStats = { total: Number(raw.total) || 0, newThisMonth: Number(raw.newThisMonth) || 0 };
  return { items: data ?? [], meta: buildMeta(page, count ?? 0, stats) };
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
      return { success: false, error: await te('errors.clientNameRequired') };
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
    return { success: false, error: await te('errors.clientCreateFailed') };
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
      return { success: false, error: await te('errors.clientNameRequired') };
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
    return { success: false, error: await te('errors.clientUpdateFailed') };
  }
}

export async function deleteClient(id: string) {
  try {
    const session = await requireAuth();
    await requireModule('CRM');
    // Seuls l'admin ou le manager peuvent supprimer un client
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
      return { success: false, error: await te('errors.clientDeleteForbidden') };
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
    return { success: false, error: await te('errors.clientDeleteFailed') };
  }
}
