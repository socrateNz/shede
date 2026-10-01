'use client';

import { useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bike, Loader2, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DecisionButtons } from '@/components/marketplace/decision-buttons';
import { setMarketplacePaused, type MarketplaceInboxOrder } from '@/app/actions/marketplace-orders';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const REFRESH_MS = 20_000;

/** Commandes marketplace à accepter, en tête de la page Commandes. */
export function MarketplaceInbox({
  orders,
  paused,
  canDecide,
}: {
  orders: MarketplaceInboxOrder[];
  paused: boolean;
  canDecide: boolean;
}) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Les nouvelles commandes arrivent par l'API : la page se rafraîchit seule.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  function togglePause() {
    startTransition(async () => {
      const result = await setMarketplacePaused(!paused);
      if (!result.success) toast.error(result.error);
      else {
        toast.success(paused ? t('marketplace.resumed') : t('marketplace.pausedToast'));
        router.refresh();
      }
    });
  }

  return (
    <section
      className={cn(
        'mb-8 rounded-xl border p-4',
        orders.length ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-700/50 bg-slate-800/40'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-100">
          <Bike className="h-5 w-5 text-emerald-400" />
          {t('marketplace.title')}
          {orders.length > 0 && (
            <span className="animate-pulse rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">{orders.length}</span>
          )}
        </h2>
        {canDecide && (
          <Button
            size="sm"
            variant="outline"
            onClick={togglePause}
            disabled={pending}
            className={paused ? 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : paused ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />}
            {paused ? t('marketplace.resume') : t('marketplace.pause')}
          </Button>
        )}
      </div>
      {paused && <p className="mt-2 text-sm text-amber-300">{t('marketplace.pausedText')}</p>}

      {orders.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{t('marketplace.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/orders/${order.id}`} className="font-semibold text-slate-50 hover:text-emerald-300">
                    {order.partner ? `${order.partner.toUpperCase()} · ` : ''}#{order.externalId ?? order.id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {[order.customerName, order.phone].filter(Boolean).join(' · ')} — {format.time(order.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {order.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums text-slate-50">{format.money(order.total)}</p>
              </div>
              {canDecide && (
                <div className="mt-3">
                  <DecisionButtons orderId={order.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
