import { requireRole } from '@/app/actions/auth';
import { getAnalyticsData } from '@/app/actions/analytics';
import { AnalyticsDashboardClient } from '@/components/analytics-dashboard-client';

export default async function AnalyticsPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const initialRange = '30';
  const initialData = await getAnalyticsData(session.structureId!, session.role as string, initialRange);

  return (
    <AnalyticsDashboardClient initialData={initialData} initialRange={initialRange} />
  );
}