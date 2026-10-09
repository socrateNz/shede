'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSession, deleteSession, getSession, hashPassword, verifyPassword } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { getT, te } from '@/lib/i18n/server';
import { ACCESS_ERROR_KEYS, checkAccountAccess } from '@/lib/account-access';
import { getCurrentDevice, randomToken, setDeviceCookie, sha256 } from '@/lib/waiter-device';

// Téléphones serveurs et connexion par code PIN (docs/phase23-waiter-pin.sql).

const ENROLL_TTL_MS = 10 * 60_000; // lien d'enregistrement valable 10 minutes
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 5 * 60_000; // blocage de 5 minutes après 5 codes faux
/** Seul le rôle Serveur se connecte par code : un code à 4 chiffres ne protège pas un compte admin. */
const PIN_ROLES = ['SERVEUR'];
const MANAGER_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const WEAK_PINS = new Set(['1234', '4321', '0123', '3210', '1212', '2580', '0852', '1004', '2000', '2026']);

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function requirePointAdmin() {
  const session = await getSession();
  if (!session?.structureId || !MANAGER_ROLES.includes(session.role) || session.pin) return null;
  return session as typeof session & { structureId: string };
}

/** Adresse publique de l'application vue par le navigateur (lien et QR code d'enregistrement). */
async function currentOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  return host ? `${proto}://${host}` : process.env.APP_URL ?? '';
}

// ── Administration (page Équipe) ──────────────────────────

export type WaiterDeviceRow = { id: string; name: string; createdAt: string; lastSeenAt: string | null };

export async function listWaiterDevices(): Promise<WaiterDeviceRow[] | null> {
  const session = await requirePointAdmin();
  if (!session) return null;
  const { data, error } = await getAdminSupabase()
    .from('waiter_devices')
    .select('id, name, created_at, last_seen_at')
    .eq('structure_id', session.structureId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) return null; // migration phase 23 absente
  return (data || []).map((d) => ({ id: d.id, name: d.name, createdAt: d.created_at, lastSeenAt: d.last_seen_at }));
}

/** Lien à usage unique (10 minutes) pour enregistrer un téléphone serveur du point. */
export async function createDeviceEnrollment(name: string): Promise<Result<{ url: string; expiresAt: string }>> {
  const session = await requirePointAdmin();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const label = String(name ?? '').trim().slice(0, 80);
  if (!label) return { success: false, error: await te('waiter.devices.nameRequired') };
  const code = randomToken();
  const expiresAt = new Date(Date.now() + ENROLL_TTL_MS).toISOString();
  const { error } = await getAdminSupabase().from('waiter_device_enrollments').insert({
    code_hash: sha256(code),
    structure_id: session.structureId,
    name: label,
    created_by: session.userId,
    expires_at: expiresAt,
  });
  if (error) return { success: false, error: await te('errors.updateFailed') };
  return { success: true, url: `${await currentOrigin()}/serveur/appareil?code=${encodeURIComponent(code)}`, expiresAt };
}

export async function revokeWaiterDevice(id: string): Promise<Result> {
  const session = await requirePointAdmin();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { data } = await getAdminSupabase()
    .from('waiter_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  return data ? { success: true } : { success: false, error: await te('errors.updateFailed') };
}

/** Définit (4 chiffres) ou retire (null) le code PIN d'un serveur du point. */
export async function setUserPin(userId: string, pin: string | null): Promise<Result> {
  const session = await requirePointAdmin();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (pin !== null) {
    if (!/^\d{4}$/.test(pin)) return { success: false, error: await te('waiter.pin.invalid') };
    if (/^(\d)\1{3}$/.test(pin) || WEAK_PINS.has(pin)) return { success: false, error: await te('waiter.pin.weak') };
  }
  const { data } = await getAdminSupabase()
    .from('users')
    .update({ pin_hash: pin === null ? null : await hashPassword(pin), pin_failed_attempts: 0, pin_locked_until: null })
    .eq('id', userId)
    .eq('structure_id', session.structureId)
    .in('role', PIN_ROLES)
    .select('id')
    .maybeSingle();
  return data ? { success: true } : { success: false, error: await te('waiter.pin.notWaiter') };
}

// ── Téléphone : enregistrement et connexion par PIN ─────────

/** Consomme un lien d'enregistrement et fait de ce navigateur un téléphone serveur. */
export async function enrollDevice(code: string): Promise<Result<{ name: string }>> {
  if (typeof code !== 'string' || code.length < 20 || code.length > 200) return { success: false, error: await te('waiter.devices.linkInvalid') };
  const admin = getAdminSupabase();
  // Usage unique : la ligne n'est prise que si elle n'a jamais servi et n'a pas expiré
  const { data: enrollment } = await admin
    .from('waiter_device_enrollments')
    .update({ used_at: new Date().toISOString() })
    .eq('code_hash', sha256(code))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('structure_id, name, created_by')
    .maybeSingle();
  if (!enrollment) return { success: false, error: await te('waiter.devices.linkInvalid') };

  const token = randomToken();
  const { error } = await admin.from('waiter_devices').insert({
    structure_id: enrollment.structure_id,
    name: enrollment.name,
    token_hash: sha256(token),
    created_by: enrollment.created_by,
  });
  if (error) return { success: false, error: await te('errors.updateFailed') };
  await setDeviceCookie(token);
  return { success: true, name: enrollment.name };
}

export type PinLoginContext =
  | { device: false }
  | { device: true; deviceName: string; pointName: string; waiters: { id: string; name: string; initials: string }[] };

/** Écran de connexion du téléphone : serveurs du point qui ont un code PIN. */
export async function getPinLoginContext(): Promise<PinLoginContext> {
  const device = await getCurrentDevice();
  if (!device) return { device: false };
  const admin = getAdminSupabase();
  const [{ data: point }, { data: users }] = await Promise.all([
    admin.from('structures').select('name').eq('id', device.structureId).maybeSingle(),
    admin
      .from('users')
      .select('id, first_name, last_name')
      .eq('structure_id', device.structureId)
      .in('role', PIN_ROLES)
      .eq('is_active', true)
      .not('pin_hash', 'is', null)
      .order('first_name'),
  ]);
  return {
    device: true,
    deviceName: device.name,
    pointName: point?.name ?? '',
    waiters: (users || []).map((u) => ({
      id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
      initials: ((u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? u.first_name?.[1] ?? '')).toUpperCase() || 'S',
    })),
  };
}

/** Connexion par code PIN, uniquement depuis un téléphone enregistré du même point. */
export async function loginWithPin(userId: string, pin: string): Promise<Result> {
  const { t } = await getT();
  const device = await getCurrentDevice();
  if (!device) return { success: false, error: t('waiter.devices.notEnrolled') };
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin) || typeof userId !== 'string') return { success: false, error: t('waiter.pin.wrong') };

  const admin = getAdminSupabase();
  const { data: user } = await admin
    .from('users')
    .select('id, email, role, structure_id, organization_id, is_active, pin_hash, pin_failed_attempts, pin_locked_until, structures(organization_id, modules), organizations(modules)')
    .eq('id', userId)
    .eq('structure_id', device.structureId)
    .in('role', PIN_ROLES)
    .maybeSingle();
  if (!user || !user.is_active || !user.pin_hash) return { success: false, error: t('waiter.pin.wrong') };

  if (user.pin_locked_until && new Date(user.pin_locked_until).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(user.pin_locked_until).getTime() - Date.now()) / 60_000);
    return { success: false, error: t('waiter.pin.locked', { minutes }) };
  }

  if (!(await verifyPassword(pin, user.pin_hash))) {
    const attempts = (Number(user.pin_failed_attempts) || 0) + 1;
    const lock = attempts >= MAX_PIN_ATTEMPTS;
    await admin
      .from('users')
      .update({ pin_failed_attempts: lock ? 0 : attempts, pin_locked_until: lock ? new Date(Date.now() + PIN_LOCK_MS).toISOString() : null })
      .eq('id', user.id);
    return {
      success: false,
      error: lock ? t('waiter.pin.locked', { minutes: PIN_LOCK_MS / 60_000 }) : t('waiter.pin.wrongLeft', { count: MAX_PIN_ATTEMPTS - attempts }),
    };
  }

  const structure = user.structures as unknown as { organization_id?: string | null; modules?: string[] } | null;
  const organization = user.organizations as unknown as { modules?: string[] } | null;
  const organizationId: string | null = user.organization_id ?? structure?.organization_id ?? null;
  const access = await checkAccountAccess(user.structure_id, organizationId);
  if (!access.ok) return { success: false, error: t(ACCESS_ERROR_KEYS[access.reason]) };

  await admin.from('users').update({ pin_failed_attempts: 0, pin_locked_until: null }).eq('id', user.id);
  await createSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    structureId: user.structure_id ?? undefined,
    organizationId: organizationId ?? undefined,
    modules: organization?.modules || structure?.modules || [],
    licenseActive: organizationId ? true : undefined,
    pin: true,
  });
  return { success: true };
}

/** « Changer de serveur » : fin de la session, le téléphone reste enregistré. */
export async function waiterLogout() {
  await deleteSession();
  redirect('/serveur/connexion');
}
