import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import ProductList from './ProductList';
import Link from 'next/link';
import { getActivePromotionsForClient } from '@/app/actions/promotions';
import { PromoBanner } from '@/components/promo-banner';

export default async function StructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const { data: structure, error: structError } = await supabase
    .from('structures')
    .select('*')
    .eq('id', id)
    .single();

  if (structError || !structure) {
    return notFound();
  }

  const { data: products } = await supabase
    .from('products')
    .select('*, product_accompaniments(quantity, accompaniments(*))')
    .eq('structure_id', id)
    .eq('is_available', true)
    .eq('is_deleted', false);

  const promotions = await getActivePromotionsForClient(id);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="bg-blue-600 rounded-2xl p-6 md:p-10 text-white shadow-md mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{structure.name}</h1>
        <p className="opacity-90">{structure.address} {structure.city && `- ${structure.city}`}</p>
        {structure.modules?.includes('HOTEL') && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="inline-block bg-white/20 px-3 py-1 text-sm font-medium rounded-full">
              Hôtel & Restauration
            </span>
            <Link
              href={`/structures/${id}/book`}
              className="inline-flex items-center bg-white text-blue-600 px-4 py-2 font-semibold rounded-full shadow-lg hover:bg-slate-50 transition"
            >
              Réserver une chambre
            </Link>
          </div>
        )}
      </div>

      <PromoBanner promotions={promotions} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">La Carte</h2>
      </div>

      <ProductList products={products || []} structureId={id} promotions={promotions} />
    </div>
  );
}
