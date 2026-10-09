'use client';

import { subscribePush, unsubscribePush } from '@/app/actions/push';

// Alertes « commande prête » du mode serveur et cache hors ligne (public/sw.js).
// Sur un téléphone partagé, l'abonnement push est rattaché au serveur connecté : il est
// réattribué à chaque connexion et retiré quand on change de serveur.

const PAGES_CACHE = 'shede-waiter-pages-v1';
// Alertes coupées volontairement par ce serveur sur ce téléphone : pas de réabonnement automatique.
const optOutKey = (userId: string) => `shede_waiter_alerts_off:${userId}`;

export type AlertsState = NotificationPermission | 'off' | 'unsupported';

function readOptOut(userId: string) {
  try {
    return localStorage.getItem(optOutKey(userId)) === '1';
  } catch {
    return false;
  }
}

function writeOptOut(userId: string, off: boolean) {
  try {
    if (off) localStorage.setItem(optOutKey(userId), '1');
    else localStorage.removeItem(optOutKey(userId));
  } catch {}
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Service worker du site ; cache hors ligne seulement en production (fichiers stables). */
export function registerWaiterWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(undefined);
  const script = process.env.NODE_ENV === 'production' ? '/sw.js?cache=1' : '/sw.js';
  return navigator.serviceWorker.register(script, { scope: '/' }).catch(() => undefined);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const raw = atob((base64String + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Abonne ce téléphone aux alertes du serveur connecté. `ask` : demander l'autorisation
 * (uniquement après un geste de l'utilisateur) ; sinon seulement si elle est déjà accordée.
 */
export async function enableWaiterPush(userId: string, ask: boolean): Promise<AlertsState> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pushSupported() || !key) return 'unsupported';
  if (!ask && readOptOut(userId)) return Notification.permission === 'denied' ? 'denied' : 'off';
  const permission = ask ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return permission;
  const registration = (await registerWaiterWorker()) ?? (await navigator.serviceWorker.ready);
  if (!registration) return 'unsupported';
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  const saved = await subscribePush(subscription.toJSON() as Parameters<typeof subscribePush>[0]);
  if (!saved?.success) throw new Error(saved?.error || 'subscribe');
  writeOptOut(userId, false);
  return 'granted';
}

/** Coupe les alertes de ce serveur sur ce téléphone (l'autorisation du navigateur reste accordée). */
export async function disableWaiterPush(userId: string): Promise<AlertsState> {
  writeOptOut(userId, true);
  const registration = await navigator.serviceWorker?.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await unsubscribePush(subscription.endpoint);
    await subscription.unsubscribe().catch(() => false);
  }
  return 'off';
}

/** Changement de serveur : ce téléphone ne reçoit plus ses alertes, et ses pages en cache sont effacées. */
export async function releaseWaiterDevice() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await unsubscribePush(subscription.endpoint);
  } catch {}
  try {
    await caches.delete(PAGES_CACHE);
  } catch {}
}
