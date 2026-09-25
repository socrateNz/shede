import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { getKitchenOrders } from '@/app/actions/kitchen';
import { KitchenDisplay } from './kitchen-display';
import { ChefHat } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('displays.meta.kitchenTitle'), description: t('displays.meta.kitchenDescription') };
}

export default async function KitchenPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CUISINIER');

  const structureId = session.structureId;
  if (!structureId) {
    const { t } = await getT();
    return (
      <div className="flex items-center justify-center flex-1 bg-slate-950 text-slate-400">
        <div className="text-center">
          <ChefHat className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <p>{t('displays.noStructure')}</p>
        </div>
      </div>
    );
  }

  const initialOrders = await getKitchenOrders(structureId);

  return (
    <KitchenDisplay
      initialOrders={initialOrders}
      structureId={structureId}
    />
  );
}
