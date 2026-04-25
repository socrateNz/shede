import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Building2, Search, Utensils, Bed, MapPin, Star, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { getAllGlobalActivePromotions } from '@/app/actions/promotions';
import { PromoBanner } from '@/components/promo-banner';

export default async function ClientHomePage() {
  // Fetch available structures joining their licenses
  const { data: rawStructures, error } = await supabase
    .from('structures')
    .select('*, licenses(is_active, expires_at)')
    .order('created_at', { ascending: false });

  // Explicitly filter in JS to guarantee correctness
  const structures = rawStructures?.filter((s: any) => {
    const license = Array.isArray(s.licenses) ? s.licenses[0] : s.licenses;
    if (!license) return false;
    if (license.is_active !== true) return false;
    if (license.expires_at) {
      const isExpired = new Date(license.expires_at).getTime() < Date.now();
      if (isExpired) return false;
    }
    return true;
  }) || [];

  if (error) {
    console.error('Error fetching structures:', error);
  }

  const globalPromotions = await getAllGlobalActivePromotions();

  // Catégories pour filtres rapides
  const categories = [
    { icon: Building2, label: 'Restaurants', type: 'RESTAURANT', color: 'from-orange-500 to-red-500' },
    { icon: Bed, label: 'Hôtels', type: 'HOTEL', color: 'from-blue-500 to-indigo-500' },
    { icon: Utensils, label: 'Bars', type: 'BAR', color: 'from-purple-500 to-pink-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Hero Section Modernisée */}
      <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 py-12 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Bienvenue sur Shede</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
            Commandez chez vos
            <br />
            établissements préférés
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Découvrez une sélection d'établissements de qualité et profitez d'offres exclusives
          </p>

          {/* Barre de recherche améliorée */}
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                id="global-search"
                name="global-search"
                placeholder="Rechercher un établissement, un plat, une boisson..."
                className="w-full pl-12 pr-24 py-4 bg-white text-slate-900 placeholder:text-slate-400 rounded-2xl focus:ring-4 focus:ring-blue-500/30 outline-none shadow-lg transition-all duration-300"
              />
              <button className="absolute right-2 top-2 bottom-2 px-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300 hover:scale-105">
                Rechercher
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-12">

        {/* Catégories rapides */}
        <div className="grid grid-cols-3 gap-3 md:gap-6">
          {categories.map((cat, idx) => (
            <button
              key={idx}
              className="group relative overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              <div className="relative">
                <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 group-hover:from-blue-50 group-hover:to-indigo-50 transition-all duration-300 mb-3">
                  <cat.icon className="w-6 h-6 md:w-8 md:h-8 text-slate-700 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm md:text-base">{cat.label}</h3>
                <p className="text-xs text-slate-500 mt-1">À découvrir</p>
              </div>
            </button>
          ))}
        </div>

        {/* Bannière promotions */}
        {globalPromotions.length > 0 && (
          <div className="animate-slide-down">
            <PromoBanner promotions={globalPromotions as any} isGlobal={true} />
          </div>
        )}

        {/* Section établissements */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800">
                Établissements disponibles
              </h2>
              <p className="text-slate-500 mt-1">
                {structures.length} établissement{structures.length > 1 ? 's' : ''} près de chez vous
              </p>
            </div>
            <Link
              href="/client/structures"
              className="hidden md:flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Voir tout
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {structures?.map((structure, index) => {
              const type = structure.type || 'RESTAURANT';
              const modules = structure.modules || [];
              const isHotel = modules.includes('HOTEL');

              return (
                <Link key={structure.id} href={`/client/structure/${structure.id}`}>
                  <div className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-500 hover:-translate-y-2">
                    {/* Bannière gradient au hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-indigo-600/0 group-hover:from-blue-600/5 group-hover:to-indigo-600/5 transition-all duration-500 z-0" />

                    <div className="relative p-5 z-10">
                      {/* Header avec icône et badge */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="relative">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 group-hover:from-blue-600 group-hover:to-indigo-600 transition-all duration-300 shadow-sm group-hover:shadow-md">
                            {type === 'HOTEL' ? (
                              <Bed className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                            ) : (
                              <Building2 className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                            )}
                          </div>
                          {/* Badge promotion simulé */}
                          <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        </div>

                        <div className="flex gap-2">
                          {isHotel && (
                            <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                              Hôtel
                            </span>
                          )}
                          <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
                            {type}
                          </span>
                        </div>
                      </div>

                      {/* Infos établissement */}
                      <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                        {structure.name}
                      </h3>

                      <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{structure.city || 'Localisation non définie'}</span>
                      </div>

                      {/* Notes fictives (amélioration UI) */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <span className="text-xs text-slate-500">(128 avis)</span>
                      </div>

                      {/* Footer avec CTA */}
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700 transition-colors">
                          Voir la carte
                        </span>
                        <div className="w-8 h-8 rounded-full bg-blue-50 group-hover:bg-blue-600 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                          <ArrowRight className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {(!structures || structures.length === 0) && (
              <div className="col-span-full py-16 text-center">
                <div className="inline-flex p-4 bg-slate-100 rounded-full mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  Aucun établissement disponible
                </h3>
                <p className="text-slate-500">
                  Revenez bientôt, de nouveaux établissements arrivent !
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section inspirante */}
        {structures.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 md:p-8 text-center">
            <TrendingUp className="w-10 h-10 text-blue-600 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Nouveautés chaque semaine
            </h3>
            <p className="text-slate-600">
              De nouveaux établissements rejoignent Shede régulièrement. Restez connecté !
            </p>
          </div>
        )}
      </div>
    </div>
  );
}