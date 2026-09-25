import { hashPassword, type UserRole } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';

export type AccountInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

/** Lit les champs `${prefix}FirstName`, `${prefix}Email`… d'un formulaire. */
export function parseAccountFormData(
  formData: FormData,
  prefix = 'admin'
): { data: AccountInput } | { error: string } {
  const firstName = String(formData.get(`${prefix}FirstName`) || '').trim();
  const lastName = String(formData.get(`${prefix}LastName`) || '').trim();
  const email = String(formData.get(`${prefix}Email`) || '').trim().toLowerCase();
  const password = String(formData.get(`${prefix}Password`) || '');

  if (!firstName || !lastName || !email || !password) {
    return { error: "Tous les champs de l'administrateur sont obligatoires." };
  }
  if (password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' };
  }
  return { data: { firstName, lastName, email, password } };
}

export async function isUserEmailTaken(email: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data } = await admin.from('users').select('id').eq('email', email).maybeSingle();
  return Boolean(data);
}

/** Crée un compte actif rattaché à une organisation et, pour le staff, à un point. */
export async function insertUserAccount(
  account: AccountInput,
  scope: { role: UserRole; organizationId: string; structureId?: string | null }
): Promise<{ user: { id: string; email: string; role: UserRole } } | { error: string }> {
  if (await isUserEmailTaken(account.email)) {
    return { error: 'Un compte existe déjà avec cet email.' };
  }

  const admin = getAdminSupabase();
  const { data: user, error } = await admin
    .from('users')
    .insert({
      organization_id: scope.organizationId,
      structure_id: scope.structureId ?? null,
      email: account.email,
      password_hash: await hashPassword(account.password),
      first_name: account.firstName,
      last_name: account.lastName,
      role: scope.role,
      is_active: true,
    })
    .select('id, email, role')
    .single();

  if (error || !user) {
    return { error: 'Échec de la création du compte.' };
  }
  return { user };
}
