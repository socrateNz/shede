import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bed, CalendarDays, UtensilsCrossed, MapPin, Store, Building2, ArrowRight, TrendingUp, Clock, Star, Wallet, Sparkles } from 'lucide-react';
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

  // Fetch all structures with their licenses
  const { data: rawStructures } = await supabase
    .from('structures')
    .select('*, licenses(is_active, expires_at)')
    .order('created_at', { ascending: false });

  const structures = rawStructures?.filter((s: any) => {
    const license = Array.isArray(s.licenses) ? s.licenses[0] : s.licenses;
    if (!license) return false;
    if (license.is_active !== true) return false;
    if (license.expires_at) {
      const isExpired = new Date(license.expires_at).getTime() < Date.now();
      if (isExpired) return false;
    }
    return true;
  }).filter(x => x.name !== "Shede HQ") || [];

  const globalPromotions = await getAllGlobalActivePromotions();

  // Statistiques
  const totalOrders = orders?.length || 0;
  const totalBookings = bookings?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === 'PENDING').length || 0;
  const upcomingBookings = bookings?.filter(b => new Date(b.check_in) > new Date()).length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-8">

        {/* Header avec effet glassmorphism */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 rounded-2xl p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-3">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">Espace Personnel</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                Bonjour et bienvenue 👋
              </h1>
              <p className="text-blue-100 text-sm md:text-base max-w-lg">
                Retrouvez ici toutes vos commandes, réservations et découvrez nos établissements partenaires.
              </p>
            </div>

            {/* Badge de statut */}
            <div className="flex gap-2">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-bold">{totalOrders + totalBookings}</div>
                <div className="text-xs text-blue-100">Total commandes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Promotions */}
        {globalPromotions.length > 0 && (
          <div className="animate-slide-down">
            <PromoBanner promotions={globalPromotions as any} isGlobal={true} />
          </div>
        )}

        {/* Cartes de statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <StatCard
            icon={<Wallet className="w-5 h-5" />}
            label="Commandes"
            value={totalOrders.toString()}
            subValue={`${pendingOrders} en cours`}
            gradient="from-emerald-500 to-teal-500"
          />
          <StatCard
            icon={<Bed className="w-5 h-5" />}
            label="Réservations"
            value={totalBookings.toString()}
            subValue={`${upcomingBookings} à venir`}
            gradient="from-purple-500 to-pink-500"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Dernière commande"
            value={orders?.[0] ? new Date(orders[0].created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-'}
            subValue={orders?.[0]?.structures?.name || 'Aucune'}
            gradient="from-orange-500 to-red-500"
          />
          {/* <StatCard
            icon={<Star className="w-5 h-5" />}
            label="Points fidélité"
            value="---"
            subValue="Bientôt disponible"
            gradient="from-yellow-500 to-amber-500"
          /> */}
        </div>

        {/* Section réservations & commandes */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Réservations Hôtel */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full -mr-16 -mt-16" />
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bed className="w-5 h-5 text-purple-600" />
                  Mes Réservations
                </CardTitle>
                <CardDescription>Vos séjours passés et à venir</CardDescription>
              </div>
              {bookings && bookings.length > 0 && (
                <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">
                  {bookings.length}
                </span>
              )}
            </CardHeader>
            <CardContent className="pt-4 max-h-[300px] overflow-y-auto custom-scrollbar">
              {bookings && bookings.length > 0 ? (
                <div className="space-y-3">
                  {bookings.map((b: any, idx: number) => {
                    const isUpcoming = new Date(b.check_in) > new Date();
                    return (
                      <div
                        key={b.id}
                        className="group/item relative p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 hover:border-purple-200 hover:shadow-md transition-all duration-300"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-800 group-hover/item:text-purple-600 transition-colors">
                              {b.rooms?.structures?.name || 'Hôtel'}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              Chambre {b.rooms?.number} • {new Date(b.check_in).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {b.check_out && ` → ${new Date(b.check_out).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                            </p>
                            {b.rooms?.price && (
                              <p className="text-xs font-medium text-purple-600 mt-1">
                                {b.rooms.price.toLocaleString()} FCFA / nuit
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                              b.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-200 text-slate-700'
                              }`}>
                              {b.status === 'CONFIRMED' ? 'Confirmé' : b.status === 'PENDING' ? 'En attente' : 'Terminé'}
                            </span>
                            {isUpcoming && b.status === 'CONFIRMED' && (
                              <span className="text-[10px] font-medium bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                                À venir
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<CalendarDays className="w-12 h-12" />}
                  title="Aucune réservation"
                  message="Vous n'avez pas encore réservé de chambre d'hôtel."
                  actionLink="/client/structures"
                  actionText="Découvrir les hôtels"
                />
              )}
            </CardContent>
          </Card>

          {/* Commandes */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full -mr-16 -mt-16" />
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                  Historique des Commandes
                </CardTitle>
                <CardDescription>Vos repas commandés</CardDescription>
              </div>
              {orders && orders.length > 0 && (
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                  {orders.length}
                </span>
              )}
            </CardHeader>
            <CardContent className="pt-4 max-h-[300px] overflow-y-auto custom-scrollbar">
              {orders && orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.map((o: any, idx: number) => (
                    <div
                      key={o.id}
                      className="group/item p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 hover:border-emerald-200 hover:shadow-md transition-all duration-300"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-800 group-hover/item:text-emerald-600 transition-colors">
                            {o.structures?.name || 'Restaurant'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm font-bold text-emerald-600 mt-2">
                            {o.total?.toLocaleString()} FCFA
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            o.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                            {o.status === 'COMPLETED' ? 'Livré' : o.status === 'PENDING' ? 'En préparation' : 'Confirmé'}
                          </span>
                          <ClientInvoiceWrapper order={o} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<UtensilsCrossed className="w-12 h-12" />}
                  title="Aucune commande"
                  message="Vous n'avez pas encore passé de commande."
                  actionLink="/client/structures"
                  actionText="Commander maintenant"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section Établissements Partenaires */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-600" />
                Établissements Partenaires
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {structures.length} établissement{structures.length > 1 ? 's' : ''} disponible{structures.length > 1 ? 's' : ''} près de chez vous
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

          {structures && structures.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {structures.map((structure, index) => {
                const type = structure.type || 'RESTAURANT';
                const isHotel = type === 'HOTEL' || type === 'MIXTE';
                const isRestaurant = type === 'RESTAURANT' || type === 'MIXTE';

                return (
                  <Link key={structure.id} href={`/client/structure/${structure.id}`}>
                    <div className="group relative bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-indigo-600/0 group-hover:from-blue-600/5 group-hover:to-indigo-600/5 transition-all duration-500" />

                      <div className="relative p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`p-2.5 rounded-xl ${isHotel ? 'bg-purple-50 group-hover:bg-purple-100' : 'bg-orange-50 group-hover:bg-orange-100'} transition-colors`}>
                            {isHotel ? (
                              <Building2 className="w-5 h-5 text-purple-600" />
                            ) : (
                              <Store className="w-5 h-5 text-orange-600" />
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            {isRestaurant && (
                              <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md">
                                Resto
                              </span>
                            )}
                            {isHotel && (
                              <span className="text-[10px] uppercase font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-md">
                                Hôtel
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-1">
                          {structure.name}
                        </h3>

                        {(structure.city || structure.address) && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                            <MapPin className="w-3 h-3" />
                            <span>{structure.city || structure.address}</span>
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">
                            Découvrir
                          </span>
                          <div className="w-7 h-7 rounded-full bg-blue-50 group-hover:bg-blue-600 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                            <ArrowRight className="w-3.5 h-3.5 text-blue-600 group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
              <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">
                Aucun établissement disponible
              </h3>
              <p className="text-slate-500 text-sm">
                De nouveaux partenaires arrivent bientôt !
              </p>
            </div>
          )}
        </div>

        {/* Footer inspirant */}
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl p-4 md:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <div>
              <p className="font-semibold text-slate-700">Nouveautés chaque semaine</p>
              <p className="text-xs text-slate-500">De nouveaux établissements nous rejoignent régulièrement</p>
            </div>
          </div>
          <Link
            href="/client/structures"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
          >
            Explorer
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// Composants réutilisables
function StatCard({ icon, label, value, subValue, gradient }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  gradient: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between mb-2">
        <div className="bg-white/20 rounded-lg p-1.5">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-white/80 mt-1">{label}</div>
      <div className="text-[10px] text-white/60 mt-0.5">{subValue}</div>
    </div>
  );
}

function EmptyState({ icon, title, message, actionLink, actionText }: {
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLink: string;
  actionText: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-slate-300 mb-3">{icon}</div>
      <h4 className="font-medium text-slate-700 mb-1">{title}</h4>
      <p className="text-sm text-slate-500 mb-4">{message}</p>
      <Link
        href={actionLink}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
      >
        {actionText}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}