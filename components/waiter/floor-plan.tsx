'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import type { WaiterTable } from '@/app/actions/waiter';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/** État d'une table pour le serveur : libre, places encore libres, complète, ou une commande prête. */
export type TableState = 'free' | 'partial' | 'full' | 'ready';

export function tableState(t: WaiterTable): TableState {
  if (!t.groups.length) return 'free';
  if (t.groups.some((g) => g.status === 'READY')) return 'ready';
  return t.capacity > 0 && t.seatsFree === 0 ? 'full' : 'partial';
}

const STYLE: Record<TableState, { box: string; chip: string }> = {
  free: { box: 'border-[#d9d6ce] bg-white', chip: 'bg-[#f1efe9] text-[#3d4048]' },
  partial: { box: 'border-[#93a5f5] bg-[#eef2ff]', chip: 'bg-[#e0e7ff] text-[#1e3a8a]' },
  full: { box: 'border-[#1e3a8a] bg-[#c7d2fe]', chip: 'bg-[#1e3a8a] text-white' },
  ready: { box: 'border-[#0f7a3f] bg-[#dcfce7]', chip: 'bg-[#0f7a3f] text-white' },
};

const PAD = 12;

/** Sur une petite table, « Table 2 » devient « 2 » (le nom complet reste dans la fiche et l'aria-label). */
const shortName = (name: string) => name.replace(/^(table|tab\.?)\s*/i, '') || name;
const MIN_SCALE = 0.45;

/**
 * Plan d'une salle tel qu'il a été disposé dans l'éditeur (positions, tailles, formes),
 * réduit pour tenir dans la largeur du téléphone (défilement horizontal si la salle est très large).
 */
export function FloorPlan({ tables, mineOnly, onOpen }: { tables: WaiterTable[]; mineOnly: boolean; onOpen: (t: WaiterTable) => void }) {
  const { t } = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(358);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cadre de la salle : de l'origine de l'éditeur jusqu'à la table la plus éloignée
  const maxX = Math.max(1, ...tables.map((tb) => tb.x + tb.w)) + PAD;
  const maxY = Math.max(1, ...tables.map((tb) => tb.y + tb.h)) + PAD;
  const scale = Math.max(MIN_SCALE, Math.min(1, width / maxX));

  return (
    <div ref={boxRef} className="overflow-x-auto overflow-y-hidden rounded-2xl border border-[#e7e5df] bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,#efede7_24px),repeating-linear-gradient(90deg,transparent,transparent_23px,#efede7_24px)] bg-white">
      <div className="relative" style={{ width: maxX * scale, height: maxY * scale }}>
        {tables.map((tb) => {
          const state = tableState(tb);
          const dim = mineOnly && !tb.groups.some((g) => g.mine);
          const small = Math.min(tb.w, tb.h) * scale < 64;
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => onOpen(tb)}
              aria-label={`${tb.name} · ${t(`waiter.floor.${state}`)}${tb.capacity ? ` · ${t('waiter.floor.seats', { taken: tb.seatsTaken, capacity: tb.capacity })}` : ''}`}
              className={cn(
                'absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden border-2 p-1 text-center shadow-sm transition-opacity',
                tb.shape === 'round' ? 'rounded-full' : 'rounded-xl',
                STYLE[state].box,
                dim && 'opacity-35',
              )}
              style={{ left: tb.x * scale, top: tb.y * scale, width: tb.w * scale, height: tb.h * scale, minWidth: 44, minHeight: 44 }}
            >
              <span className={cn('max-w-full truncate font-extrabold leading-tight', small ? 'text-[12px]' : 'text-sm')}>{small ? shortName(tb.name) : tb.name}</span>
              {tb.capacity > 0 && (
                <span className={cn('rounded-full px-1.5 font-bold leading-tight', small ? 'text-[10px]' : 'text-[11px]', STYLE[state].chip)}>
                  {tb.seatsTaken}/{tb.capacity}
                </span>
              )}
              {state === 'ready' && <Bell className="absolute right-1 top-1 h-3.5 w-3.5 text-[#0f7a3f]" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Vue liste (grille de cases), pratique quand la salle compte beaucoup de tables. */
export function FloorList({ tables, onOpen }: { tables: WaiterTable[]; onOpen: (t: WaiterTable) => void }) {
  const { t } = useT();
  return (
    <div className="grid grid-cols-3 gap-3">
      {tables.map((tb) => {
        const state = tableState(tb);
        return (
          <button
            key={tb.id}
            type="button"
            onClick={() => onOpen(tb)}
            className={cn('flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 px-2 py-3', STYLE[state].box)}
          >
            <span className="max-w-full truncate text-lg font-extrabold">{tb.name}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', STYLE[state].chip)}>{t(`waiter.floor.${state}`)}</span>
            <span className="min-h-[15px] text-xs text-[#5b5e66]">
              {tb.capacity > 0 ? t('waiter.floor.seats', { taken: tb.seatsTaken, capacity: tb.capacity }) : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Légende des couleurs (les états sont aussi écrits en toutes lettres dans la vue liste et les fiches). */
export function FloorLegend() {
  const { t } = useT();
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs font-semibold text-[#3d4048]">
      {(['free', 'partial', 'full', 'ready'] as const).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn('h-3 w-3 rounded border-2', STYLE[s].box)} aria-hidden />
          {t(`waiter.floor.${s}`)}
        </li>
      ))}
    </ul>
  );
}
