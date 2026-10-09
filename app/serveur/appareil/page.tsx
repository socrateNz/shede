'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Smartphone, XCircle } from 'lucide-react';
import { enrollDevice } from '@/app/actions/waiter-devices';
import { useT } from '@/lib/i18n/client';

/** Ouvert depuis le lien ou le QR code généré par un responsable : enregistre ce téléphone. */
function EnrollDevice() {
  const { t } = useT();
  const code = useSearchParams().get('code') ?? '';
  const [state, setState] = useState<{ status: 'pending' } | { status: 'done'; name: string } | { status: 'error'; error: string }>({ status: 'pending' });
  const started = useRef(false);

  useEffect(() => {
    // Lien à usage unique : un seul appel, même si React rejoue l'effet
    if (started.current) return;
    started.current = true;
    enrollDevice(code)
      .then((r) => setState(r.success ? { status: 'done', name: r.name } : { status: 'error', error: r.error }))
      .catch(() => setState({ status: 'error', error: t('waiter.errors.network') }));
  }, [code, t]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-5 bg-[#f6f5f2] px-6 text-center">
      {state.status === 'pending' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-[#6d28d9]" aria-hidden />
          <p className="text-lg font-bold">{t('waiter.devices.enrolling')}</p>
        </>
      )}
      {state.status === 'done' && (
        <>
          <CheckCircle2 className="h-14 w-14 text-[#0f7a3f]" aria-hidden />
          <h1 className="text-2xl font-extrabold">{t('waiter.devices.enrolledTitle')}</h1>
          <p className="text-[15px] text-[#3d4048]">{t('waiter.devices.enrolledText', { name: state.name })}</p>
          <Link href="/serveur/connexion" className="mt-2 flex h-14 w-full items-center justify-center rounded-[18px] bg-[#6d28d9] text-base font-extrabold text-white">
            {t('waiter.devices.continue')}
          </Link>
        </>
      )}
      {state.status === 'error' && (
        <>
          <XCircle className="h-14 w-14 text-[#b42318]" aria-hidden />
          <p className="text-[15px] font-semibold text-[#3d4048]">{state.error}</p>
          <Smartphone className="h-6 w-6 text-[#5b5e66]" aria-hidden />
        </>
      )}
    </main>
  );
}

export default function DeviceEnrollmentPage() {
  return (
    <Suspense>
      <EnrollDevice />
    </Suspense>
  );
}
