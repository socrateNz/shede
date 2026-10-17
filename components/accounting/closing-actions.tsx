'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { closeFiscalYear, reopenFiscalYear } from '@/app/actions/closing';
import { useDialogs } from '@/components/dialog-provider';
import { useT } from '@/lib/i18n/client';

/** Clôture de l'exercice en cours (confirmation demandée avant l'action). */
export function CloseYearButton({ start, end, result, disabled }: { start: string; end: string; result: number; disabled?: boolean }) {
  const { t, format } = useT();
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending || disabled}
      onClick={async () => {
        const ok = await dialogs.confirm({
          description: t('accounting.closing.closeConfirm', { from: format.date(start), to: format.date(end), result: format.money(result) }),
          destructive: true,
        });
        if (!ok) return;
        startTransition(async () => {
          const res = await closeFiscalYear(start, end);
          if (!res.success) return void toast.error(res.error);
          toast.success(t('accounting.closing.closed', { result: format.money(res.data?.result ?? 0) }));
          router.refresh();
        });
      }}
      className="bg-emerald-600 text-white hover:bg-emerald-700"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
      {t('accounting.closing.close')}
    </Button>
  );
}

/** Réouverture du dernier exercice clôturé (administrateur). */
export function ReopenYearButton({ id, start, end }: { id: string; start: string; end: string }) {
  const { t, format } = useT();
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        if (!(await dialogs.confirm({ description: t('accounting.closing.reopenConfirm', { from: format.date(start), to: format.date(end) }), destructive: true }))) return;
        startTransition(async () => {
          const res = await reopenFiscalYear(id);
          if (!res.success) return void toast.error(res.error);
          toast.success(t('accounting.closing.reopened'));
          router.refresh();
        });
      }}
      className="h-8 text-amber-300 hover:bg-amber-500/10"
    >
      {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LockOpen className="mr-1 h-4 w-4" />}
      {t('accounting.closing.reopen')}
    </Button>
  );
}
