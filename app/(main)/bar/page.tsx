import { requireRole } from '@/app/actions/auth';
import { getBarOrders } from '@/app/actions/kitchen';
import { BarDisplay } from './bar-display';
import { Beer } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('displays.meta.barTitle'), description: t('displays.meta.barDescription') };
}

export default async function BarPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BAR');

  const structureId = session.structureId;
  if (!structureId) {
    const { t } = await getT();
    return (
      <div className="flex items-center justify-center flex-1 bg-slate-950 text-slate-400">
        <div className="text-center">
          <Beer className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <p>{t('displays.noStructure')}</p>
        </div>
      </div>
    );
  }

  const initialOrders = await getBarOrders(structureId);

  return <BarDisplay initialOrders={initialOrders} structureId={structureId} />;
}
