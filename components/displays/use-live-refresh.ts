'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Message envoyé par le service worker (public/sw.js) à chaque notification push reçue. */
export const REFRESH_MESSAGE = 'shede:refresh';

type LiveRefreshOptions = {
  /** Rythme sans notifications push sur cet appareil. */
  intervalMs?: number;
  /** Rythme quand les notifications push sont actives : elles préviennent déjà instantanément. */
  pushIntervalMs?: number;
  /** Suspendu (ex. plan de salle en cours de modification). */
  paused?: boolean;
};

/** Notifications push actives sur cet appareil (autorisées et abonnées). */
function usePushActive() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration('/')
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => !cancelled && setActive(Boolean(subscription)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return active;
}

/**
 * Garde un écran à jour sans surcharger le serveur : rechargement immédiat à chaque notification
 * push, régulier tant que l'onglet est visible (pause sinon), et au retour sur l'onglet ou du réseau.
 * `online` passe à false quand le dernier rechargement a échoué.
 */
export function useLiveRefresh(load: () => Promise<void>, { intervalMs = 5000, pushIntervalMs = intervalMs, paused = false }: LiveRefreshOptions = {}) {
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
  const inFlight = useRef(false);
  const loadRef = useRef(load);
  const pushActive = usePushActive();

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  /** `manual` : demandé par un bouton (icône qui tourne) ; les rechargements automatiques restent discrets. */
  const refresh = useCallback(async (manual = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (manual) setRefreshing(true);
    try {
      await loadRef.current();
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      inFlight.current = false;
      if (manual) setRefreshing(false);
    }
  }, []);

  const every = pushActive ? pushIntervalMs : intervalMs;
  useEffect(() => {
    if (paused) return;
    const whenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = setInterval(whenVisible, every);
    document.addEventListener('visibilitychange', whenVisible);
    window.addEventListener('online', whenVisible);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === REFRESH_MESSAGE) void refresh();
    };
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    sw?.addEventListener('message', onMessage);
    sw?.startMessages();

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', whenVisible);
      window.removeEventListener('online', whenVisible);
      sw?.removeEventListener('message', onMessage);
    };
  }, [refresh, every, paused]);

  return { refresh, refreshing, online };
}
