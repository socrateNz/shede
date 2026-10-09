import { requireModule } from '@/app/actions/auth';
import { listPurchaseOrders } from '@/app/actions/purchasing';
import { PurchaseOrdersList } from '@/components/purchasing/orders-list';
import { parsePage } from '@/lib/pagination';

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string }> }) {
  const session = await requireModule('ACHATS');
  const params = await searchParams;
  // 20 bons de commande par page ; totaux par statut calculés en SQL.
  const result = await listPurchaseOrders({ page: parsePage(params.page), q: params.q, status: params.status });
  return <PurchaseOrdersList result={result} canManage={['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(session.role)} />;
}
