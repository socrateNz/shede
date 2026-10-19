'use client';

// Application installable (PWA) : un seul service worker pour tout le site (public/sw.js).
// Toutes les pages l'enregistrent avec la même adresse, sinon les enregistrements se remplacent.

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Chrome/Edge/Android proposent l'installation très tôt : l'évènement est gardé pour le bouton.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Service worker du site ; cache hors ligne seulement en production (fichiers stables). */
export function registerAppWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(undefined);
  const script = process.env.NODE_ENV === 'production' ? '/sw.js?cache=1' : '/sw.js';
  return navigator.serviceWorker.register(script, { scope: '/' }).catch(() => undefined);
}

/** L'application tourne déjà depuis l'écran d'accueil. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad : pas d'invite d'installation, il faut passer par le menu Partager de Safari. */
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canPromptInstall() {
  return deferredPrompt !== null;
}

export function onInstallChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ouvre l'invite d'installation du navigateur ; `true` si la personne a accepté. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}
