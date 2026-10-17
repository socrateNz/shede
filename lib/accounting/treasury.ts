import { getAdminSupabase } from '@/lib/supabase';

// Compte de trésorerie choisi au paiement (module serveur, pas une Server Action) :
// le compte du plan du compte bancaire sélectionné, s'il appartient bien au point.

/** Compte du plan (ex. 5211) du compte bancaire choisi ; null = compte par défaut du moyen de paiement. */
export async function bankAccountNumber(structureId: string, bankAccountId: string | null | undefined): Promise<string | null> {
  if (!bankAccountId || !/^[0-9a-f-]{36}$/i.test(bankAccountId)) return null;
  const { data, error } = await getAdminSupabase()
    .from('bank_accounts')
    .select('account')
    .eq('id', bankAccountId)
    .eq('structure_id', structureId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) return null; // table absente avant docs/phase25-bank.sql
  return (data?.account as string | undefined) ?? null;
}
