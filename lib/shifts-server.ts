import { getAdminSupabase } from '@/lib/supabase';

// Fonctions internes aux actions serveur : pas dans un fichier « use server »,
// donc jamais appelables directement depuis le navigateur.

/** Session de caisse ouverte d'un point (null si la caisse est fermée). */
export async function getStructureActiveShift(structureId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('shifts')
    .select('*')
    .eq('structure_id', structureId)
    .eq('status', 'OPEN')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching structure active shift:', error);
    return null;
  }
  return data;
}
