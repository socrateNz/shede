'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, LockOpen, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateMissingEntries, setAccountingLock } from '@/app/actions/accounting';
import { useT } from '@/lib/i18n/client';

export function GenerateMissingButton({ from, to }: { from: string; to: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await generateMissingEntries(from, to);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          const { created = 0, failed = 0 } = result.data ?? {};
          if (failed) toast.warning(t('accounting.dashboard.generatedWithErrors', { count: created, failed }));
          else toast.success(t('accounting.dashboard.generated', { count: created }));
          router.refresh();
        })
      }
      className="bg-amber-500 text-slate-950 hover:bg-amber-400"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
      {pending ? t('accounting.dashboard.generating') : t('accounting.dashboard.generate')}
    </Button>
  );
}

export function LockForm({ lockedUntil, canUnlock }: { lockedUntil: string | null; canUnlock: boolean }) {
  const { t, format } = useT();
  const router = useRouter();
  const [date, setDate] = useState('');
  const [pending, startTransition] = useTransition();

  function save(next: string | null) {
    if (next && !confirm(t('accounting.dashboard.lockConfirm', { date: format.date(next) }))) return;
    startTransition(async () => {
      const result = await setAccountingLock(next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.dashboard.lockSaved'));
      setDate('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        {lockedUntil
          ? t('accounting.dashboard.lockedUntil', { date: format.date(lockedUntil) })
          : t('accounting.dashboard.notLocked')}
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (date) save(date);
        }}
      >
        <label className="text-xs text-slate-400">
          {t('accounting.dashboard.lockDate')}
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 h-9 w-44 border-slate-600 bg-slate-900/50 text-slate-100 [color-scheme:dark]"
          />
        </label>
        <Button type="submit" size="sm" disabled={pending || !date} className="h-9 bg-slate-700 text-white hover:bg-slate-600">
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />}
          {t('accounting.dashboard.lock')}
        </Button>
        {lockedUntil && canUnlock && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => save(null)}
            className="h-9 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <LockOpen className="mr-1.5 h-4 w-4" />
            {t('accounting.dashboard.unlock')}
          </Button>
        )}
      </form>
    </div>
  );
}
