'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Banknote, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cancelExpense, payExpense } from '@/app/actions/accounting';
import { PAYMENT_METHODS } from '@/lib/accounting/mapping';
import { useT } from '@/lib/i18n/client';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Actions d'une ligne de dépense : régler, annuler (contrepassation). */
export function ExpenseActions({
  id,
  status,
  expenseDate,
  canCancel,
}: {
  id: string;
  status: string;
  expenseDate: string;
  canCancel: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState('CASH');
  const [date, setDate] = useState(today());

  if (status === 'CANCELLED') return null;

  function pay() {
    startTransition(async () => {
      const result = await payExpense(id, method, date);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.expenses.paid'));
      setPayOpen(false);
      router.refresh();
    });
  }

  function cancel() {
    if (!confirm(t('accounting.expenses.cancelConfirm'))) return;
    const reason = prompt(t('accounting.expenses.cancelReason')) ?? undefined;
    startTransition(async () => {
      const result = await cancelExpense(id, reason);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.expenses.cancelled'));
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1">
      {status === 'UNPAID' && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setPayOpen(true)} className="h-8 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300">
          <Banknote className="mr-1 h-4 w-4" />
          {t('accounting.expenses.pay')}
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={cancel} className="h-8 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="mr-1 h-4 w-4" />}
          {t('accounting.expenses.cancelAction')}
        </Button>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="border-slate-700 bg-slate-800 text-slate-100 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('accounting.expenses.payTitle')}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              pay();
            }}
          >
            <label className="block space-y-1 text-sm text-slate-300">
              {t('accounting.expenses.form.paymentMethod')}
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-100">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`accounting.paymentMethods.${m}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm text-slate-300">
              {t('accounting.expenses.payDate')}
              <Input type="date" value={date} min={expenseDate} max={today()} onChange={(e) => setDate(e.target.value)} required className="border-slate-600 bg-slate-900/50 text-slate-100 [color-scheme:dark]" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPayOpen(false)} className="text-slate-300">
                {t('accounting.common.cancel')}
              </Button>
              <Button type="submit" disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('accounting.common.confirm')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
