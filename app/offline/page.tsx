import { WifiOff } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export const metadata = { robots: { index: false } };

/**
 * Affichée par le service worker (public/sw.js) à la place d'une page quand le réseau ne répond pas.
 * Sans JavaScript : « Réessayer » recharge simplement l'adresse demandée.
 */
export default async function OfflinePage() {
  const { t } = await getT();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-900 p-6 text-center">
      <div className="w-full max-w-sm space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-slate-300">
          <WifiOff className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-slate-50">{t('common.pwa.offlineTitle')}</h1>
        <p className="text-sm leading-relaxed text-slate-400">{t('common.pwa.offlineText')}</p>
        <a
          href=""
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700"
        >
          {t('common.pwa.retry')}
        </a>
      </div>
    </div>
  );
}
