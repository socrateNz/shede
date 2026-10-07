import { notFound } from 'next/navigation';
import { requireModule } from '@/app/actions/auth';
import { getPurchaseOrder } from '@/app/actions/purchasing';
import { PurchaseOrderDetailView } from '@/components/purchasing/order-detail';
import { getAdminSupabase } from '@/lib/supabase';

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireModule('ACHATS');
  const order = await getPurchaseOrder((await params).id);
  if (!order) notFound();
  const { data: point } = await getAdminSupabase().from('structures').select('name').eq('id', session.structureId).maybeSingle();
  return <PurchaseOrderDetailView order={order} pointName={point?.name ?? ''} />;
}
