import { requireModule } from '@/app/actions/auth';
import { listInventories } from '@/app/actions/inventory';
import { InventoriesList } from '@/components/inventories-list';
import { parsePage } from '@/lib/pagination';

export default async function InventoriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireModule('STOCK');
  const params = await searchParams;
  // 20 inventaires par page ; l'inventaire en cours vient des statistiques SQL.
  return <InventoriesList result={await listInventories({ page: parsePage(params.page) })} />;
}
