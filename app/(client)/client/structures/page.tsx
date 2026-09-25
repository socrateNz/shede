import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, MapPin, Store, ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { isStructureVisible, STRUCTURE_LICENSE_SELECT } from '@/lib/license';
import { getT } from '@/lib/i18n/server';

export default async function ClientStructuresPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const supabase = getAdminSupabase();
  const { t } = await getT();

  // Points visibles : actifs et dont l'organisation a une licence valide
  const { data: rawStructures } = await supabase
    .from('structures')
    .select(`*, ${STRUCTURE_LICENSE_SELECT}`)
    .order('name', { ascending: true });

  const structures = rawStructures?.filter(isStructureVisible).filter(x => x.name !== "Shede HQ") || [];

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-200">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-8">
        
        {/* Header Premium */}
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-100 p-8 md:p-12">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-50 blur-3xl opacity-60" />
          
          <Link 
            href="/client" 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 text-slate-600 font-medium text-sm hover:bg-slate-100 hover:text-slate-900 transition-all mb-8 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('client.catalogue.back')}
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
                {t('client.catalogue.title')}
              </h1>
              <p className="text-lg text-slate-500 font-medium leading-relaxed">
                {t('client.catalogue.text')}
              </p>
            </div>
            <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-lg shadow-lg flex items-center gap-3 whitespace-nowrap">
              <Store className="w-5 h-5 text-blue-400" />
              {t('client.catalogue.partners', { count: structures.length })}
            </div>
          </div>
        </div>

        {/* Liste des établissements */}
        {structures.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {structures.map((structure, index) => {
              const type = structure.type || 'RESTAURANT';
              const isHotel = type === 'HOTEL' || type === 'MIXTE';
              const isRestaurant = type === 'RESTAURANT' || type === 'MIXTE';

              return (
                <Link key={structure.id} href={`/client/structure/${structure.id}`}>
                  <div 
                    className="group h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-blue-100 transition-all duration-500 transform hover:-translate-y-1.5 flex flex-col"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    
                    {/* Image Header */}
                    <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
                      {structure.logo_url ? (
                        <img 
                          src={structure.logo_url} 
                          alt={structure.name} 
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" 
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${isHotel ? 'from-purple-400 to-indigo-600' : 'from-orange-400 to-red-500'}`}>
                          {isHotel ? <Building2 className="w-20 h-20 text-white/50" /> : <Store className="w-20 h-20 text-white/50" />}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
                      
                      {/* Badges on image */}
                      <div className="absolute top-4 left-4 flex gap-2">
                        {isRestaurant && (
                          <span className="text-[10px] uppercase tracking-wider font-bold bg-white text-orange-600 px-3 py-1.5 rounded-full shadow-lg">
                            {t('client.types.RESTAURANT')}
                          </span>
                        )}
                        {isHotel && (
                          <span className="text-[10px] uppercase tracking-wider font-bold bg-white text-purple-600 px-3 py-1.5 rounded-full shadow-lg">
                            {t('client.types.HOTEL')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="relative p-6 flex flex-col flex-1">
                      <h3 className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">
                        {structure.name}
                      </h3>

                      {(structure.city || structure.address) && (
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-6 flex-1">
                          <div className="p-1.5 bg-slate-100 rounded-md shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <span className="line-clamp-2 leading-relaxed">{structure.city || structure.address}</span>
                        </div>
                      )}

                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {t('client.catalogue.seeDetails')}
                        </span>
                        <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-blue-600 flex items-center justify-center transition-all duration-300 shadow-sm group-hover:shadow-blue-200">
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-16 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {t('client.home.noneTitle')}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto">
              {t('client.catalogue.noneText')}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
