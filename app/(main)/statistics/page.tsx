import { redirect } from 'next/navigation';
import { requireRole } from '@/app/actions/auth';
import { getAnalyticsData } from '@/app/actions/analytics';
import { AnalyticsDashboardClient } from '@/components/analytics-dashboard-client';

export default async function StatisticsPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN');
  const initialRange = '30';
  // Périmètre déterminé par la session ; totaux calculés en SQL.
  const initialData = await getAnalyticsData(initialRange);
  if (!initialData) redirect('/dashboard');

  return (
    <AnalyticsDashboardClient initialData={initialData} initialRange={initialRange} />
  );
}
