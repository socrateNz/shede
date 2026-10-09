import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getAdminSupabase } from '@/lib/supabase';

// Téléphones serveurs (docs/phase23-waiter-pin.sql). Le téléphone garde une clé secrète dans
// un cookie protégé ; la base n'en stocke que l'empreinte SHA-256. Module serveur interne.

export const DEVICE_COOKIE = 'shede_waiter_device';
const DEVICE_MAX_AGE = 60 * 60 * 24 * 365; // un an ; révocable par l'admin à tout moment

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');

export type WaiterDevice = { id: string; structureId: string; name: string };

/** Téléphone serveur de la requête en cours (cookie valide et non révoqué), sinon null. */
export async function getCurrentDevice(): Promise<WaiterDevice | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('waiter_devices')
    .select('id, structure_id, name, last_seen_at')
    .eq('token_hash', sha256(token))
    .is('revoked_at', null)
    .maybeSingle();
  if (!data) return null;
  // Dernière utilisation, au plus une écriture toutes les 5 minutes
  if (!data.last_seen_at || Date.now() - new Date(data.last_seen_at).getTime() > 5 * 60_000) {
    await admin.from('waiter_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  }
  return { id: data.id, structureId: data.structure_id, name: data.name };
}

export async function setDeviceCookie(token: string) {
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEVICE_MAX_AGE,
  });
}
