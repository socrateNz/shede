'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { acceptMarketplaceOrder, rejectMarketplaceOrder } from '@/app/actions/marketplace-orders';
import { useT } from '@/lib/i18n/client';

const PREP_CHOICES = [10, 15, 20, 30, 45, 60];

/** Accepter (avec temps de préparation) ou refuser une commande marketplace. */
export function DecisionButtons({ orderId, onDone }: { orderId: string; onDone?: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [minutes, setMinutes] = useState(20);

  function done(message: string) {
    toast.success(message);
    onDone?.();
    router.refresh();
  }

  function accept() {
    startTransition(async () => {
      const result = await acceptMarketplaceOrder(orderId, minutes);
      if (!result.success) toast.error(result.error);
      else done(t('marketplace.accepted'));
    });
  }

  function reject() {
    const reason = prompt(t('marketplace.rejectReason'));
    if (reason === null) return;
    startTransition(async () => {
      const result = await rejectMarketplaceOrder(orderId, reason);
      if (!result.success) toast.error(result.error);
      else done(t('marketplace.rejected'));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-slate-300">
        {t('marketplace.prepTime')}
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          disabled={pending}
          className="rounded-md border border-slate-600 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100"
        >
          {PREP_CHOICES.map((m) => (
            <option key={m} value={m}>
              {t('marketplace.minutes', { count: m })}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" onClick={accept} disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
        {t('marketplace.accept')}
      </Button>
      <Button size="sm" variant="outline" onClick={reject} disabled={pending} className="border-red-900/60 text-red-400 hover:bg-red-900/30 hover:text-red-300">
        <X className="mr-1.5 h-4 w-4" />
        {t('marketplace.reject')}
      </Button>
    </div>
  );
}
