import { requireModule } from '@/app/actions/auth';
import { listPurchasingSuppliers } from '@/app/actions/purchasing';
import { SuppliersManager } from '@/components/purchasing/suppliers-manager';

export default async function SuppliersPage() {
  const session = await requireModule('ACHATS');
  const suppliers = await listPurchasingSuppliers();
  return <SuppliersManager suppliers={suppliers} canManage={['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(session.role)} />;
}
