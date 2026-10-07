import { requireRole } from '@/app/actions/auth';
import { listCategories } from '@/app/actions/categories';
import { CategoriesManager } from '@/components/categories-manager';

export default async function CategoriesPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN');
  const categories = await listCategories();
  return <CategoriesManager initialCategories={categories} />;
}
