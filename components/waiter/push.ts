'use client';

import { subscribePush, unsubscribePush } from '@/app/actions/push';

// Alertes « commande prête » du mode serveur et cache hors ligne (public/sw.js).
// Sur un téléphone partagé, l'abonnement push est rattaché au serveur connecté : il est
// réattribué à chaque connexion et retiré quand on change de serveur.

const PAGES_CACHE = 'shede-waiter-pages-v1';

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
export async function enableWaiterPush(ask: boolean): Promise<NotificationPermission | 'unsupported'> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pushSupported() || !key) return 'unsupported';
  const permission = ask ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return permission;
  const registration = (await registerWaiterWorker()) ?? (await navigator.serviceWorker.ready);
  if (!registration) return 'unsupported';
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  await subscribePush(subscription.toJSON() as Parameters<typeof subscribePush>[0]);
  return 'granted';
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
