import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { getPinLoginContext } from '@/app/actions/waiter-devices';
import { PinLogin } from '@/components/waiter/pin-login';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** Écran du téléphone serveur : choisir son prénom puis taper son code PIN. */
export default async function WaiterPinLoginPage() {
  const context = await getPinLoginContext();
  const { t } = await getT();

  if (!context.device) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 bg-[#f6f5f2] px-6 text-center">
        <Smartphone className="h-12 w-12 text-[#5b5e66]" aria-hidden />
        <h1 className="text-2xl font-extrabold">{t('waiter.devices.notEnrolledTitle')}</h1>
        <p className="text-[15px] text-[#3d4048]">{t('waiter.devices.notEnrolledText')}</p>
        <Link href="/login?redirect=/serveur" className="mt-2 text-[15px] font-semibold text-[#5b21b6] underline-offset-2 hover:underline">
          {t('waiter.devices.staffLogin')}
        </Link>
      </main>
    );
  }

  return <PinLogin pointName={context.pointName} deviceName={context.deviceName} waiters={context.waiters} />;
}
