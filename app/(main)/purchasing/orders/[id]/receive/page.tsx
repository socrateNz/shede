import { notFound, redirect } from 'next/navigation';
import { requireModule } from '@/app/actions/auth';
import { getPurchaseOrder } from '@/app/actions/purchasing';
import { ReceiptForm } from '@/components/purchasing/receipt-form';

export default async function ReceiveOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireModule('ACHATS');
  const id = (await params).id;
  const order = await getPurchaseOrder(id);
  if (!order) notFound();
  if (!['DRAFT', 'SENT', 'PARTIAL'].includes(order.status)) redirect(`/purchasing/orders/${id}`);
  return <ReceiptForm order={order} hasAccounting={Boolean(session.modules?.includes('COMPTABILITE'))} />;
}
