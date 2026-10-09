import { requireModule } from '@/app/actions/auth';
import { listSuppliersPage } from '@/app/actions/purchasing';
import { SuppliersManager } from '@/components/purchasing/suppliers-manager';
import { parsePage } from '@/lib/pagination';

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const session = await requireModule('ACHATS');
  const params = await searchParams;
  // 20 fournisseurs par page, recherche côté serveur.
  const result = await listSuppliersPage({ page: parsePage(params.page), q: params.q });
  return <SuppliersManager result={result} canManage={['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(session.role)} />;
}
