import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Building2, Search, Utensils, Bed } from 'lucide-react';

export default async function ClientHomePage() {
  // Fetch available structures joining their licenses
  // Filter for those with an active license and deadline > now or no deadline limit
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

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenue sur Shede</h1>
        <p className="text-slate-500">Commandez directement depuis votre établissement préféré.</p>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input 
          type="text"
          placeholder="Rechercher un établissement..." 
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {structures?.map((structure) => {
          const type = structure.type || 'RESTAURANT';
          const modules = structure.modules || [];
          
          return (
            <Link key={structure.id} href={`/structures/${structure.id}`}>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow p-5 flex flex-col group cursor-pointer h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {type === 'HOTEL' ? <Bed className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                  </div>
                  {modules.includes('HOTEL') && (
                    <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                      Hôtel
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{structure.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{structure.city || 'Localisation non définie'}</p>
                <div className="mt-auto flex items-center justify-between text-blue-600 text-sm font-medium">
                  <span>Voir la carte</span>
                  <span>&rarr;</span>
                </div>
              </div>
            </Link>
          );
        })}
        {(!structures || structures.length === 0) && (
          <div className="col-span-full py-12 text-center text-slate-500">
            Aucun établissement disponible pour le moment.
          </div>
        )}
      </div>
    </div>
  );
}
