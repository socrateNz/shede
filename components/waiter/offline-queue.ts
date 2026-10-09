'use client';

import type { WaiterOrderInput } from '@/app/actions/waiter';

// File d'attente hors ligne du mode serveur, gardée sur le téléphone (localStorage).
// Chaque envoi garde son identifiant (ref) : renvoyé plusieurs fois, il n'est traité qu'une
// fois par le serveur. Un ajout à un groupe pas encore créé attend ce groupe (groupRef).

export type QueuedOrder = {
  ref: string;
  payload: WaiterOrderInput;
  /** Envoi qui crée le groupe auquel celui-ci ajoute des plats (groupe ouvert hors ligne). */
  groupRef?: string;
  tableName: string;
  lineCount: number;
  total: number;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
};

const MAX_RESOLVED = 100;

const keys = (userId: string) => ({ queue: `shede.waiter.queue.${userId}`, resolved: `shede.waiter.resolved.${userId}` });

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage plein ou interdit (navigation privée) : la file reste en mémoire pour cette session.
  }
}

export function loadQueue(userId: string): QueuedOrder[] {
  const list = read<QueuedOrder[]>(keys(userId).queue, []);
  return Array.isArray(list) ? list : [];
}

export function saveQueue(userId: string, queue: QueuedOrder[]) {
  write(keys(userId).queue, queue);
}

/** Commandes créées par un envoi (ref → orderId), pour rattacher les ajouts suivants. */
export function loadResolved(userId: string): Record<string, string> {
  return read<Record<string, string>>(keys(userId).resolved, {});
}

export function saveResolved(userId: string, resolved: Record<string, string>) {
  const entries = Object.entries(resolved).slice(-MAX_RESOLVED);
  write(keys(userId).resolved, Object.fromEntries(entries));
}
