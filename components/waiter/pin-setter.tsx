'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { setUserPin } from '@/app/actions/waiter-devices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/client';

/** Fiche d'un serveur : définir ou retirer son code PIN du mode serveur. */
export function WaiterPinSetter({ userId, hasPin }: { userId: string; hasPin: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [pending, startTransition] = useTransition();

  const save = (value: string | null) =>
    startTransition(async () => {
      const r = await setUserPin(userId, value);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(value === null ? t('waiter.pin.removed') : t('waiter.pin.saved'));
      setPin('');
      router.refresh();
    });

  return (
    <section className="mt-6 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-xl">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
        <KeyRound className="h-5 w-5 text-blue-400" aria-hidden />
        {t('waiter.pin.title')}
      </h2>
      <p className="mt-1 text-sm text-slate-400">{t('waiter.pin.hint')}</p>
      <p className="mt-3 text-sm font-medium text-slate-200">{hasPin ? t('waiter.pin.hasPin') : t('waiter.pin.noPin')}</p>
      <form
        className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          save(pin);
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="waiter-pin">{t('waiter.pin.label')}</Label>
          <Input
            id="waiter-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-40 tracking-[0.5em]"
          />
        </div>
        <Button type="submit" disabled={pending || pin.length !== 4}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {t('waiter.pin.save')}
        </Button>
        {hasPin && (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => save(null)} className="text-red-300 hover:bg-red-500/10 hover:text-red-200">
            {t('waiter.pin.remove')}
          </Button>
        )}
      </form>
    </section>
  );
}
