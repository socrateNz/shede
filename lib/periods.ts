// Périodes des rapports (jours civils au Cameroun : UTC+1, sans heure d'été).

export const PERIOD_KEYS = ['d7', 'd30', 'month', 'lastMonth'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

const OFFSET_MS = 3600_000; // UTC+1

/** Début du jour local (Douala) d'un instant, en UTC. */
function startOfLocalDay(date: Date) {
  const local = new Date(date.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET_MS);
}

function startOfLocalMonth(date: Date, monthShift = 0) {
  const local = new Date(date.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + monthShift, 1) - OFFSET_MS);
}

export function parsePeriod(value: string | string[] | undefined): PeriodKey {
  const key = Array.isArray(value) ? value[0] : value;
  return PERIOD_KEYS.includes(key as PeriodKey) ? (key as PeriodKey) : 'd30';
}

/** Bornes [from, to[ en ISO pour une période. */
export function periodRange(key: PeriodKey, now = new Date()) {
  const tomorrow = new Date(startOfLocalDay(now).getTime() + 86_400_000);
  switch (key) {
    case 'd7':
      return { from: new Date(tomorrow.getTime() - 7 * 86_400_000).toISOString(), to: tomorrow.toISOString() };
    case 'month':
      return { from: startOfLocalMonth(now).toISOString(), to: tomorrow.toISOString() };
    case 'lastMonth':
      return { from: startOfLocalMonth(now, -1).toISOString(), to: startOfLocalMonth(now).toISOString() };
    default:
      return { from: new Date(tomorrow.getTime() - 30 * 86_400_000).toISOString(), to: tomorrow.toISOString() };
  }
}
