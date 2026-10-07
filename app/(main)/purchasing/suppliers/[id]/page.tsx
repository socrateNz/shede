import { notFound } from 'next/navigation';
import { requireModule } from '@/app/actions/auth';
import { getSupplierCatalog } from '@/app/actions/purchasing';
import { CatalogManager } from '@/components/purchasing/catalog-manager';

export default async function SupplierCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule('ACHATS');
  const data = await getSupplierCatalog((await params).id);
  if (!data) notFound();
  return <CatalogManager supplier={data.supplier} items={data.items} options={data.options} canManage={data.canManage} />;
}
