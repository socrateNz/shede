import { redirect } from 'next/navigation';
import { requireModule } from '@/app/actions/auth';
import { getOrderFormData, listPurchasingSuppliers } from '@/app/actions/purchasing';
import { PurchaseOrderForm } from '@/components/purchasing/order-form';
import { getT } from '@/lib/i18n/server';

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  await requireModule('ACHATS');
  if ((await listPurchasingSuppliers()) === null) {
    const { t } = await getT();
    return <p className="m-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('purchasing.notInstalled')}</p>;
  }
  const data = await getOrderFormData();
  if (!data) redirect('/purchasing/orders');
  const supplierId = (await searchParams).supplier;
  return (
    <PurchaseOrderForm
      suppliers={data.suppliers}
      catalogs={data.catalogs}
      initial={supplierId && data.suppliers.some((s) => s.id === supplierId) ? { supplierId, expectedDate: null, note: null, quantities: {} } : undefined}
    />
  );
}
