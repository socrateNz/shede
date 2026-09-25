'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bike, CheckCircle2, Loader2, UserPlus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { assignCourier, updateDeliveryStatus } from '@/app/actions/delivery';
import { useT } from '@/lib/i18n/client';

type Courier = { id: string; first_name: string | null; last_name: string | null };

/** Actions d'une course selon le rôle : affecter, prendre, partir, livrée, échec. */
export function DeliveryActions({
  orderId,
  deliveryStatus,
  courierId,
  role,
  userId,
  couriers,
}: {
  orderId: string;
  deliveryStatus: string;
  courierId: string | null;
  role: string;
  userId: string;
  couriers: Courier[];
}) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');

  const isManager = role === 'ADMIN' || role === 'MANAGER';
  const isMine = courierId === userId;
  const canMove = isManager || isMine;

  function run(action: () => Promise<{ success: boolean; error: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(successMessage);
        setFailing(false);
        setReason('');
        router.refresh();
      } else {
        toast.error(result.error || t('delivery.actions.genericError'));
      }
    });
  }

  return (
    <div className="space-y-3">
      {isManager && (deliveryStatus === 'TO_ASSIGN' || deliveryStatus === 'ASSIGNED') && (
        <div className="space-y-1.5">
          <label htmlFor={`courier-${orderId}`} className="text-xs text-slate-400">{t('delivery.actions.courier')}</label>
          <select
            id={`courier-${orderId}`}
            value={courierId ?? ''}
            disabled={pending}
            onChange={(e) => run(() => assignCourier(orderId, e.target.value || null), t('delivery.actions.courierUpdated'))}
            className="w-full rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">{t('delivery.actions.unassigned')}</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.first_name, c.last_name].filter(Boolean).join(' ') || t('delivery.actions.courierFallback')}
              </option>
            ))}
          </select>
          {couriers.length === 0 && (
            <p className="text-xs text-amber-400">{t('delivery.actions.noCouriers')}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {role === 'LIVREUR' && deliveryStatus === 'TO_ASSIGN' && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => assignCourier(orderId, userId), t('delivery.actions.taken'))}
            className="bg-cyan-600 text-white hover:bg-cyan-700"
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> {t('delivery.actions.take')}
          </Button>
        )}

        {canMove && deliveryStatus === 'ASSIGNED' && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => updateDeliveryStatus(orderId, 'IN_TRANSIT'), t('delivery.actions.left'))}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Bike className="mr-1.5 h-4 w-4" /> {t('delivery.actions.leave')}
          </Button>
        )}

        {canMove && deliveryStatus === 'IN_TRANSIT' && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => updateDeliveryStatus(orderId, 'DELIVERED'), t('delivery.actions.delivered'))}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> {t('delivery.actions.deliver')}
          </Button>
        )}

        {canMove && (deliveryStatus === 'ASSIGNED' || deliveryStatus === 'IN_TRANSIT') && !failing && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setFailing(true)}
            className="border-red-900/60 text-red-400 hover:bg-red-900/30 hover:text-red-300"
          >
            <XCircle className="mr-1.5 h-4 w-4" /> {t('delivery.actions.fail')}
          </Button>
        )}

        {pending && <Loader2 className="h-4 w-4 animate-spin self-center text-slate-400" />}
      </div>

      {failing && (
        <div className="space-y-2 rounded-lg border border-red-900/50 bg-red-950/20 p-3">
          <label htmlFor={`reason-${orderId}`} className="text-xs text-red-300">{t('delivery.actions.failReason')}</label>
          <input
            id={`reason-${orderId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('delivery.actions.failPlaceholder')}
            className="w-full rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !reason.trim()}
              onClick={() => run(() => updateDeliveryStatus(orderId, 'FAILED', reason), t('delivery.actions.failed'))}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t('delivery.actions.confirmFail')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFailing(false)} className="text-slate-400">
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
