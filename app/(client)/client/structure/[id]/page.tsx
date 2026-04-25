import { getAdminSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import ProductList from './ProductList';
import Link from 'next/link';
import { getActivePromotionsForClient } from '@/app/actions/promotions';
import { PromoBanner } from '@/components/promo-banner';
import { Building2, MapPin, Phone, Star, Clock, Coffee, Bed, UtensilsCrossed, Sparkles, ArrowRight } from 'lucide-react';

export default async function StructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const isHotel = structure.modules?.includes('HOTEL') || structure.type === 'HOTEL' || structure.type === 'MIXTE';
  const isRestaurant = structure.modules?.includes('RESTAURANT') || structure.type === 'RESTAURANT' || structure.type === 'MIXTE';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 py-8 md:py-12 text-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
              {isHotel ? <Bed className="w-5 h-5" /> : <UtensilsCrossed className="w-5 h-5" />}
            </div>
            <span className="text-sm font-medium bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              {isHotel && isRestaurant ? 'Hôtel & Restaurant' : isHotel ? 'Hôtel' : 'Restaurant'}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">{structure.name}</h1>

          <div className="flex flex-wrap items-center gap-3 text-blue-100 mb-6">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{structure.address} {structure.city && `- ${structure.city}`}</span>
            </div>
            {structure.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                <span className="text-sm">{structure.phone}</span>
              </div>
            )}
          </div>

          {/* <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="text-sm ml-1">(128 avis)</span>
            </div>
            <div className="w-1 h-1 bg-white/30 rounded-full" />
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Ouvert</span>
            </div>
          </div> */}

          {(isHotel) && (
            <div className="mt-6">
              <Link
                href={`/client/structure/${id}/book`}
                className="inline-flex items-center gap-2 bg-white text-blue-600 px-5 py-2.5 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <Bed className="w-4 h-4" />
                Réserver une chambre
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Promotions */}
        {promotions && promotions.length > 0 && (
          <div className="animate-slide-down">
            <PromoBanner promotions={promotions} />
          </div>
        )}

        {/* Menu Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5" />
              Notre Carte
            </h2>
            <p className="text-slate-300 text-sm mt-0.5">Découvrez nos délicieux plats et boissons</p>
          </div>
          <div className="p-6">
            <ProductList products={products || []} structureId={id} promotions={promotions} />
          </div>
        </div>

        {/* Footer Info */}
        {/* <div className="bg-gradient-to-r from-slate-100 to-white rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Coffee className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">Heures d'ouverture</p>
              <p className="text-xs text-slate-500">Lun - Dim: 08:00 - 22:00</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-full">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">Commandez en ligne</p>
              <p className="text-xs text-slate-500">Livraison rapide et gratuite</p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}