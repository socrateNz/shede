import { requireModule } from '@/app/actions/auth';
import { listInventories } from '@/app/actions/inventory';
import { InventoriesList } from '@/components/inventories-list';

export default async function InventoriesPage() {
  await requireModule('STOCK');
  return <InventoriesList inventories={await listInventories()} />;
}
