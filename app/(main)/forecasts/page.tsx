import { requireModule } from '@/app/actions/auth';
import { getForecastDashboard } from '@/app/actions/forecasts';
import { ForecastsDashboard } from '@/components/forecasts-dashboard';
import { getT } from '@/lib/i18n/server';

// Toujours recalculé : les prévisions dépendent des ventes du jour et des événements.
export const dynamic = 'force-dynamic';

export default async function ForecastsPage() {
  await requireModule('PREVISIONS');
  const data = await getForecastDashboard();
  if (!data || !data.installed) {
    const { t } = await getT();
    return <p className="m-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('forecasts.notInstalled')}</p>;
  }
  return (
    <ForecastsDashboard
      today={data.today}
      days={data.days}
      products={data.products}
      events={data.events}
      trend={data.trend}
      openDays={data.openDays}
      accuracy={data.accuracy}
      todayActual={data.todayActual}
    />
  );
}
