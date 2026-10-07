import { getAdminSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import ProductList from './ProductList';
import Link from 'next/link';
import { getActivePromotionsForClient } from '@/app/actions/promotions';
import { PromoBanner } from '@/components/promo-banner';
import { Building2, MapPin, Phone, Bed, UtensilsCrossed, ArrowRight, ArrowLeft } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { categoriesForProducts } from '@/lib/categories';

export default async function StructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  
  const supabase = getAdminSupabase();

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
  const { categories, byProduct } = await categoriesForProducts(id, (products || []).map((p) => p.id as string));
  const menu = (products || []).map((p) => ({ ...p, categoryIds: (byProduct.get(p.id) ?? []).map((c) => c.id) }));

  const isHotel = structure.modules?.includes('HOTEL') || structure.type === 'HOTEL' || structure.type === 'MIXTE';
  const isRestaurant = structure.modules?.includes('RESTAURANT') || structure.type === 'RESTAURANT' || structure.type === 'MIXTE';

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-200">
      {/* Hero Section Premium */}
      <div className="relative h-[40vh] min-h-[350px] overflow-hidden bg-slate-900">
        {structure.logo_url ? (
          <img 
            src={structure.logo_url} 
            alt={structure.name} 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${isHotel ? 'from-purple-900 via-indigo-900 to-blue-900' : 'from-orange-900 via-red-900 to-rose-900'} opacity-80`} />
        )}
        
        {/* Gradients pour la lisibilité */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/20 to-transparent" />

        <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-end pb-12">
          
          <Link 
            href="/client/structures" 
            className="absolute top-6 left-4 md:left-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white/90 hover:bg-white/20 hover:text-white transition-all text-sm font-medium border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('client.structure.back')}
          </Link>

          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/20">
                {isHotel ? <Bed className="w-6 h-6 text-white" /> : <UtensilsCrossed className="w-6 h-6 text-white" />}
              </div>
              <span className="text-sm font-bold tracking-wider uppercase text-white/90 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                {isHotel && isRestaurant ? t('client.types.MIXTE') : isHotel ? t('client.types.HOTEL') : t('client.types.RESTAURANT')}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-lg">
              {structure.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-white/80">
              <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5">
                <MapPin className="w-4 h-4 text-blue-300" />
                <span className="font-medium">{structure.address} {structure.city && `- ${structure.city}`}</span>
              </div>
              {structure.phone && (
                <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5">
                  <Phone className="w-4 h-4 text-blue-300" />
                  <span className="font-medium">{structure.phone}</span>
                </div>
              )}
            </div>

            {(isHotel) && (
              <div className="mt-8">
                <Link
                  href={`/client/structure/${id}/book`}
                  className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 font-bold text-lg rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:-translate-y-1 transition-all duration-300"
                >
                  <Bed className="w-5 h-5 text-purple-600" />
                  {t('client.structure.bookStay')}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-8 -mt-8 relative z-20">
        {/* Promotions */}
        {promotions && promotions.length > 0 && (
          <div className="animate-slide-down shadow-xl rounded-2xl overflow-hidden">
            <PromoBanner promotions={promotions} />
          </div>
        )}

        {/* Menu Section */}
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
                <UtensilsCrossed className="w-6 h-6 text-blue-400" />
                {t('client.structure.menu')}
              </h2>
              <p className="text-slate-400 font-medium mt-1">{t('client.structure.menuText')}</p>
            </div>
          </div>
          <div className="p-6 md:p-8 bg-slate-50/50">
            <ProductList
              products={menu}
              structureId={id}
              promotions={promotions}
              categories={categories.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}