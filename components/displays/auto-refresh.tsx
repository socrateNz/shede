'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveRefresh } from '@/components/displays/use-live-refresh';

/**
 * Recharge la page affichée (rendue côté serveur) à chaque notification push et régulièrement,
 * avec les mêmes règles que les écrans cuisine et bar (pause onglet caché). N'affiche rien.
 */
export function AutoRefresh({ intervalMs, pushIntervalMs, paused }: { intervalMs: number; pushIntervalMs?: number; paused?: boolean }) {
  const router = useRouter();
  const load = useCallback(async () => {
    router.refresh();
  }, [router]);
  useLiveRefresh(load, { intervalMs, pushIntervalMs, paused });
  return null;
}
