'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Message envoyé par le service worker (public/sw.js) à chaque notification push reçue. */
export const REFRESH_MESSAGE = 'shede:refresh';

/**
 * Garde un écran (cuisine, bar) à jour : rechargement immédiat à chaque notification push,
 * toutes les `intervalMs` tant que l'onglet est visible, et au retour sur l'onglet ou du réseau.
 * `online` passe à false quand le dernier rechargement a échoué.
 */
export function useLiveRefresh(load: () => Promise<void>, intervalMs = 5000) {
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
  const inFlight = useRef(false);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  /** `manual` : demandé par le bouton (icône qui tourne) ; les rechargements automatiques restent discrets. */
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

  useEffect(() => {
    const whenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = setInterval(whenVisible, intervalMs);
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
  }, [refresh, intervalMs]);

  return { refresh, refreshing, online };
}
