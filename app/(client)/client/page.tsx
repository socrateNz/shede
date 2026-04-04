import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bed, CalendarDays, UtensilsCrossed, MapPin, Store, Building2, ArrowRight } from 'lucide-react';
import { ClientInvoiceWrapper } from '@/components/client-invoice-wrapper';
import Link from 'next/link';
import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PromoBanner } from '@/components/promo-banner';
import { getAllGlobalActivePromotions } from '@/app/actions/promotions';

export default async function ClientDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const supabase = getAdminSupabase();

  // Fetch their bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(*, structures(name))')
    .eq('client_id', session.userId)
    .order('created_at', { ascending: false });

  // Fetch their orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*, structures(name), rooms(number), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
    .or(`client_id.eq.${session.userId},user_id.eq.${session.userId}`)
    .order('created_at', { ascending: false });

  // Fetch all structures with their licenses so the client has something to browse
  const { data: rawStructures } = await supabase
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

  const globalPromotions = await getAllGlobalActivePromotions();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bienvenue sur votre Espace Client</h1>
        <p className="text-slate-500 mt-2 line-clamp-2 md:line-clamp-none">
          Retrouvez ici toutes vos commandes, réservations et parcourez nos établissements partenaires.
        </p>
      </div>

      {globalPromotions.length > 0 && (
        <PromoBanner promotions={globalPromotions as any} isGlobal={true} />
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Mes Réservations d'Hôtel</CardTitle>
              <CardDescription>Vos prochains séjours</CardDescription>
            </div>
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Bed className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {bookings && bookings.length > 0 ? (
              <div className="space-y-3">
                {bookings.map((b: any) => (
                  <div key={b.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{b.rooms?.structures?.name || 'Hôtel'}</p>
                      <p className="text-xs text-slate-500">
                        Chambre {b.rooms?.number} • {new Date(b.check_in).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                        b.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CalendarDays className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-sm">Vous n'avez pas de réservation en cours.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Mon Historique de Commandes</CardTitle>
              <CardDescription>Vos repas passés</CardDescription>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {orders && orders.length > 0 ? (
              <div className="space-y-3">
                {orders.map((o: any) => (
                  <div key={o.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{o.structures?.name || 'Restaurant'}</p>
                      <p className="text-xs text-slate-500">
                        Total : {o.total} FCFA • {new Date(o.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          o.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                          {o.status}
                        </span>
                        <ClientInvoiceWrapper order={o} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <UtensilsCrossed className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-sm">Vous n'avez pas encore commandé de délicieux repas.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Directory Section */}
      <div className="pt-4 border-t border-slate-200">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Nos Établissements Partenaires</h2>

        {structures && structures.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {structures.filter(x => x.name !== "Shede HQ").map((structure) => {
              const type = structure.type || 'RESTAURANT';
              const isHotel = type === 'HOTEL' || type === 'MIXTE';
              const isRestaurant = type === 'RESTAURANT' || type === 'MIXTE';

              return (
                <Link key={structure.id} href={`/structures/${structure.id}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow group cursor-pointer border-slate-200 hover:border-blue-300">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className={`p-3 rounded-xl ${isHotel ? 'bg-purple-100' : 'bg-orange-100'}`}>
                          {isHotel ? <Building2 className="w-6 h-6 text-purple-600" /> : <Store className="w-6 h-6 text-orange-600" />}
                        </div>
                        <div className="flex gap-1">
                          {isRestaurant && <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-sm">Resto</span>}
                          {isHotel && <span className="text-[10px] uppercase tracking-wider font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-sm">Hôtel</span>}
                        </div>
                      </div>
                      <CardTitle className="text-xl text-slate-800 group-hover:text-blue-600 transition-colors">
                        {structure.name}
                      </CardTitle>
                      {(structure.city || structure.address) && (
                        <CardDescription className="flex items-center gap-1 mt-1 font-medium">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {structure.city || structure.address}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center text-sm font-semibold text-blue-600 group-hover:gap-2 transition-all">
                        Découvrir la carte / les réservations
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
            Aucun établissement n'est encore disponible sur la plateforme.
          </div>
        )}
      </div>

    </div>
  );
}
