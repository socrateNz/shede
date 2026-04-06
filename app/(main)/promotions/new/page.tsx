import { getProducts } from '@/app/actions/products';
import { requireRole } from '@/app/actions/auth';
import { PromotionFormClient } from './promotion-form-client';

export default async function NewPromotionPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <PromotionFormClient products={products} />
    </div>
  );
}
