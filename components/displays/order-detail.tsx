'use client';

import { Bike, BedDouble, ShoppingBag, User, UtensilsCrossed, Users } from 'lucide-react';
import type { KitchenOrder } from '@/app/actions/kitchen';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/** Où servir, couverts, serveur et client : tout ce que la cuisine et le bar doivent savoir. */
export function OrderPlace({ order }: { order: KitchenOrder }) {
  const { t } = useT();
  const { place } = order;
  const Icon = place.kind === 'TABLE' ? UtensilsCrossed : place.kind === 'ROOM' ? BedDouble : place.kind === 'DELIVERY' ? Bike : ShoppingBag;
  const label =
    place.kind === 'TABLE'
      ? /^\d+$/.test(place.label ?? '') || !place.label
        ? t('displays.detail.table', { name: place.label ?? '—' })
        : place.label // nom saisi à la création (« Table 3 », « Bar 1 »…)
      : place.kind === 'ROOM'
      ? place.label ? t('displays.detail.room', { number: place.label }) : t('displays.room')
      : place.kind === 'DELIVERY'
      ? t('displays.detail.delivery')
      : t('displays.takeaway');

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-2 text-base font-bold text-white">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate">{label}</span>
        {place.floor && <span className="truncate text-sm font-medium text-slate-400">· {place.floor}</span>}
      </p>
      {(order.covers || order.waiter || order.customer || order.phone) && (
        <div className="flex flex-wrap gap-1.5 text-xs text-slate-300">
          {order.covers && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-700/60 px-2 py-0.5">
              <Users className="h-3 w-3" aria-hidden />
              {t('displays.detail.covers', { count: order.covers })}
            </span>
          )}
          {order.waiter && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-700/60 px-2 py-0.5">
              <User className="h-3 w-3" aria-hidden />
              {t('displays.detail.waiter', { name: order.waiter })}
            </span>
          )}
          {(order.customer || order.phone) && (
            <span className="rounded-md bg-slate-700/60 px-2 py-0.5">{[order.customer, order.phone].filter(Boolean).join(' · ')}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Lignes à préparer : quantité, plat, accompagnements, note, et « suite » pour les plats envoyés plus tard. */
export function OrderItems({ order, tone }: { order: KitchenOrder; tone: 'amber' | 'blue' }) {
  const { t } = useT();
  return (
    <ul className="space-y-2.5">
      {order.items.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
              tone === 'amber' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
            )}
          >
            {item.quantity}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-semibold text-slate-100">{item.product_name}</span>
              {item.late && (
                <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">
                  {t('displays.detail.late')}
                </span>
              )}
            </p>
            {item.accompaniments.length > 0 && (
              <ul className="mt-1 space-y-0.5 border-l-2 border-slate-600 pl-2.5">
                {item.accompaniments.map((a, i) => (
                  <li key={i} className="text-sm text-slate-300">
                    + {a.quantity > 1 ? `${a.quantity} × ` : ''}
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
            {item.notes && <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-sm font-medium text-amber-200">⚠ {item.notes}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
