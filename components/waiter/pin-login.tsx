'use client';

import { useState } from 'react';
import { ChevronLeft, Delete, Loader2 } from 'lucide-react';
import { loginWithPin } from '@/app/actions/waiter-devices';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/** Connexion du serveur sur un téléphone partagé : prénom, puis code à 4 chiffres. */
export function PinLogin({
  pointName,
  deviceName,
  waiters,
}: {
  pointName: string;
  deviceName: string;
  waiters: { id: string; name: string; initials: string }[];
}) {
  const { t } = useT();
  const [waiter, setWaiter] = useState<(typeof waiters)[number] | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (code: string) => {
    if (!waiter) return;
    setBusy(true);
    setError('');
    try {
      const r = await loginWithPin(waiter.id, code);
      if (r.success) {
        // Navigation complète : le nouveau cookie de session est pris en compte partout
        window.location.assign('/serveur');
        return;
      }
      setError(r.error);
      setPin('');
    } catch {
      setError(t('waiter.errors.network'));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const press = (key: (typeof KEYS)[number]) => {
    if (busy || !key) return;
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    const next = (pin + key).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-7 bg-[#f6f5f2] px-6 pb-8 pt-12">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6d28d9] text-xl font-extrabold text-white">S</span>
        <div>
          <p className="text-lg font-extrabold">{pointName || 'Shede'}</p>
          <p className="text-sm text-[#5b5e66]">{deviceName}</p>
        </div>
      </div>

      {!waiter ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-[26px] font-extrabold">{t('waiter.pin.who')}</h1>
          {waiters.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-[15px] text-[#3d4048]">{t('waiter.pin.noWaiters')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {waiters.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setWaiter(w);
                    setPin('');
                    setError('');
                  }}
                  className="flex min-h-[120px] flex-col items-center justify-center gap-2.5 rounded-[18px] bg-white px-3 py-4 shadow-[0_1px_2px_rgba(23,24,28,.08)]"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ede9fe] text-xl font-extrabold text-[#4c1d95]">{w.initials}</span>
                  <span className="max-w-full truncate text-base font-bold">{w.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-1 flex-col items-center gap-5">
          <button type="button" onClick={() => setWaiter(null)} className="flex min-h-11 items-center gap-1 self-start text-[15px] font-semibold text-[#5b21b6]">
            <ChevronLeft className="h-5 w-5" aria-hidden /> {t('waiter.pin.change')}
          </button>
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#ede9fe] text-[26px] font-extrabold text-[#4c1d95]">{waiter.initials}</span>
          <div className="text-center">
            <p className="text-[22px] font-extrabold">{waiter.name}</p>
            <p className="mt-1 text-[15px] text-[#5b5e66]">{t('waiter.pin.enter')}</p>
          </div>
          <div className="flex gap-4" role="status" aria-label={t('waiter.pin.enter')}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn('h-4 w-4 rounded-full border-2 border-[#17181c]', i < pin.length && 'bg-[#17181c]')} />
            ))}
          </div>
          <p className="min-h-5 text-center text-sm font-semibold text-[#b42318]" role="alert">
            {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#5b5e66]" aria-hidden /> : error}
          </p>
          <div className="grid w-full max-w-[300px] grid-cols-3 gap-3">
            {KEYS.map((k, i) =>
              k ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => press(k)}
                  disabled={busy}
                  aria-label={k === 'del' ? t('waiter.pin.erase') : t('waiter.pin.digit', { digit: k })}
                  className="flex h-16 items-center justify-center rounded-[18px] bg-white text-2xl font-bold disabled:opacity-60"
                >
                  {k === 'del' ? <Delete className="h-6 w-6" aria-hidden /> : k}
                </button>
              ) : (
                <span key={i} aria-hidden />
              ),
            )}
          </div>
        </section>
      )}
    </main>
  );
}
