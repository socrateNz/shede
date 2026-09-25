import { createHash, randomBytes } from 'crypto';
import { getAdminSupabase } from '@/lib/supabase';

// Liens de (ré)initialisation de mot de passe — table password_reset_tokens
// (docs/phase8-password-reset.sql). Seule l'empreinte SHA-256 est stockée.

export type PasswordTokenPurpose = 'RESET' | 'INVITE';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Crée un jeton et renvoie sa valeur en clair (à placer uniquement dans l'email). */
export async function createPasswordToken(
  userId: string,
  purpose: PasswordTokenPurpose
): Promise<string | null> {
  const token = randomBytes(32).toString('base64url');
  const ttl = purpose === 'INVITE' ? INVITE_TOKEN_TTL_MS : RESET_TOKEN_TTL_MS;

  const admin = getAdminSupabase();
  const { error } = await admin.from('password_reset_tokens').insert({
    user_id: userId,
    token_hash: hashToken(token),
    purpose,
    expires_at: new Date(Date.now() + ttl).toISOString(),
  });

  if (error) {
    console.error('[password-tokens] création impossible :', error.message);
    return null;
  }
  return token;
}

/** Vrai si une demande de réinitialisation a été faite il y a moins de `withinMs`. */
export async function hasRecentResetToken(userId: string, withinMs: number) {
  const admin = getAdminSupabase();
  const { count } = await admin
    .from('password_reset_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('purpose', 'RESET')
    .gte('created_at', new Date(Date.now() - withinMs).toISOString());
  return (count ?? 0) > 0;
}

/** Vérifie un jeton sans le consommer (affichage de la page). */
export async function isPasswordTokenValid(token: string) {
  if (!token) return false;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('password_reset_tokens')
    .select('id')
    .eq('token_hash', hashToken(token))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

/**
 * Consomme un jeton de façon atomique (un seul usage) et renvoie l'utilisateur
 * concerné. Les autres liens encore valides de cet utilisateur sont invalidés.
 */
export async function consumePasswordToken(token: string): Promise<string | null> {
  if (!token) return null;
  const admin = getAdminSupabase();
  const now = new Date().toISOString();

  const { data } = await admin
    .from('password_reset_tokens')
    .update({ used_at: now })
    .eq('token_hash', hashToken(token))
    .is('used_at', null)
    .gt('expires_at', now)
    .select('user_id')
    .maybeSingle();

  if (!data) return null;

  await admin
    .from('password_reset_tokens')
    .update({ used_at: now })
    .eq('user_id', data.user_id)
    .is('used_at', null);

  return data.user_id as string;
}
