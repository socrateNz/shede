import { requireModule } from '@/app/actions/auth';
import { listPurchaseOrders } from '@/app/actions/purchasing';
import { PurchaseOrdersList } from '@/components/purchasing/orders-list';

export default async function PurchaseOrdersPage() {
  const session = await requireModule('ACHATS');
  const orders = await listPurchaseOrders();
  return <PurchaseOrdersList orders={orders} canManage={['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(session.role)} />;
}
