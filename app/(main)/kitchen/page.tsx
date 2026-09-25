import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { getKitchenOrders } from '@/app/actions/kitchen';
import { KitchenDisplay } from './kitchen-display';
import { ChefHat } from 'lucide-react';

export const metadata = {
  title: 'Cuisine — Shede KDS',
  description: 'Kitchen Display System',
};

export default async function KitchenPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CUISINIER');

  const structureId = session.structureId;
  if (!structureId) {
    return (
      <div className="flex items-center justify-center flex-1 bg-slate-950 text-slate-400">
        <div className="text-center">
          <ChefHat className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <p>Aucun établissement associé à ce compte.</p>
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
