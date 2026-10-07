import { notFound } from 'next/navigation';
import { requireModule } from '@/app/actions/auth';
import { getInventory } from '@/app/actions/inventory';
import { InventoryCount } from '@/components/inventory-count';

export default async function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule('STOCK');
  const inventory = await getInventory((await params).id);
  if (!inventory) notFound();
  return <InventoryCount inventory={inventory} />;
}
