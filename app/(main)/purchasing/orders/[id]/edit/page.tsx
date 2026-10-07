import { notFound, redirect } from 'next/navigation';
import { requireModule } from '@/app/actions/auth';
import { getOrderFormData, getPurchaseOrder } from '@/app/actions/purchasing';
import { PurchaseOrderForm } from '@/components/purchasing/order-form';

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule('ACHATS');
  const id = (await params).id;
  const [order, data] = await Promise.all([getPurchaseOrder(id), getOrderFormData()]);
  if (!order) notFound();
  if (!data || order.status !== 'DRAFT') redirect(`/purchasing/orders/${id}`);

  return (
    <PurchaseOrderForm
      suppliers={data.suppliers}
      catalogs={data.catalogs}
      initial={{
        id: order.id,
        number: order.number,
        supplierId: order.supplier_id,
        expectedDate: order.expected_date,
        note: order.note,
        quantities: Object.fromEntries(order.lines.filter((l) => l.supplier_item_id).map((l) => [l.supplier_item_id!, l.quantity])),
      }}
    />
  );
}
