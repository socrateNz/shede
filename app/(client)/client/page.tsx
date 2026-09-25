import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bed, CalendarDays, UtensilsCrossed, MapPin, Store, Building2, ArrowRight, TrendingUp, Clock, Wallet, ChevronRight, Sparkles } from 'lucide-react';
import { ClientInvoiceWrapper } from '@/components/client-invoice-wrapper';
import Link from 'next/link';
import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PromoBanner } from '@/components/promo-banner';
import { getAllGlobalActivePromotions } from '@/app/actions/promotions';
import { isStructureVisible, STRUCTURE_LICENSE_SELECT } from '@/lib/license';
import { getT } from '@/lib/i18n/server';
import type { TranslationKey } from '@/lib/i18n/translate';

export default async function ClientDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  const { t, format } = await getT();

  const supabase = getAdminSupabase();

  // Fetch their bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(*, structures(*))')
    .eq('client_id', session.userId)
    .order('created_at', { ascending: false });

  // Fetch their orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*, structures(*), rooms(number), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
    .or(`client_id.eq.${session.userId},user_id.eq.${session.userId}`)
    .order('created_at', { ascending: false });

  // Points visibles : actifs et dont l'organisation a une licence valide
  const { data: rawStructures } = await supabase
    .from('structures')
    .select(`*, ${STRUCTURE_LICENSE_SELECT}`)
    .order('created_at', { ascending: false });

  const structures = rawStructures?.filter(isStructureVisible).filter(x => x.name !== "Shede HQ") || [];

  const globalPromotions = await getAllGlobalActivePromotions();

  // Statistiques
  const totalOrders = orders?.length || 0;
  const totalBookings = bookings?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === 'PENDING').length || 0;
  const upcomingBookings = bookings?.filter(b => new Date(b.check_in) > new Date()).length || 0;

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-200">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-12">

        {/* Hero Section Premium */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl">
          {/* Background effects */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
          <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-blue-500 blur-3xl opacity-30 animate-pulse" />
          <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-96 h-96 rounded-full bg-purple-500 blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/90 to-transparent" />

          <div className="relative p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-2xl z-10">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 tracking-tight leading-tight">
                {t('client.dashboard.hello')} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  {t('client.dashboard.tagline')}
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-300 font-medium max-w-lg leading-relaxed">
                {t('client.dashboard.intro')}
              </p>
            </div>

            {/* Quick Stats in Hero */}
            <div className="flex gap-4 z-10">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 text-center transform transition-transform hover:scale-105 hover:bg-white/15">
                <div className="text-4xl font-black text-white mb-1">{totalOrders + totalBookings}</div>
                <div className="text-sm font-medium text-blue-200">{t('client.dashboard.interactions')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Promotions */}
        {globalPromotions.length > 0 && (
          <div className="animate-slide-down transform hover:scale-[1.01] transition-transform">
            <PromoBanner promotions={globalPromotions as any} isGlobal={true} />
          </div>
        )}

        {/* Statistiques Modernes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            icon={<Wallet className="w-6 h-6" />}
            label={t('client.dashboard.yourOrders')}
            value={totalOrders.toString()}
            subValue={t('client.dashboard.inPreparation', { count: pendingOrders })}
            bgClass="bg-white"
            iconColor="text-emerald-500"
            iconBg="bg-emerald-50"
          />
          <StatCard
            icon={<Bed className="w-6 h-6" />}
            label={t('client.dashboard.hotelBookings')}
            value={totalBookings.toString()}
            subValue={t('client.dashboard.upcomingStays', { count: upcomingBookings })}
            bgClass="bg-white"
            iconColor="text-purple-500"
            iconBg="bg-purple-50"
          />
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            label={t('client.dashboard.lastVisit')}
            value={orders?.[0] ? format.date(orders[0].created_at, { day: 'numeric', month: 'short' }) : '-'}
            subValue={orders?.[0]?.structures?.name || t('client.dashboard.noRecentActivity')}
            bgClass="bg-white"
            iconColor="text-orange-500"
            iconBg="bg-orange-50"
          />
        </div>

        {/* Établissements Premium */}
        <div className="py-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Store className="w-8 h-8 text-blue-600" />
                {t('client.dashboard.ourPlaces')}
              </h2>
              <p className="text-slate-500 mt-2 font-medium text-lg">
                {t('client.dashboard.ourPlacesText')}
              </p>
            </div>
            <Link
              href="/client/structures"
              className="hidden md:flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-full transition-all"
            >
              {t('client.dashboard.seeCatalogue')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {structures && structures.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {structures.map((structure, index) => {
                const type = structure.type || 'RESTAURANT';
                const isHotel = type === 'HOTEL' || type === 'MIXTE';
                const isRestaurant = type === 'RESTAURANT' || type === 'MIXTE';

                return (
                  <Link key={structure.id} href={`/client/structure/${structure.id}`}>
                    <div className="group h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-blue-100 transition-all duration-500 transform hover:-translate-y-1.5 flex flex-col">

                      {/* Image Header */}
                      <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                        {structure.logo_url ? (
                          <img
                            src={structure.logo_url}
                            alt={structure.name}
                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${isHotel ? 'from-purple-400 to-indigo-600' : 'from-orange-400 to-red-500'}`}>
                            {isHotel ? <Building2 className="w-16 h-16 text-white/50" /> : <Store className="w-16 h-16 text-white/50" />}
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
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-6">
                            <div className="p-1.5 bg-slate-100 rounded-md">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <span className="line-clamp-1">{structure.city || structure.address}</span>
                          </div>
                        )}

                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {t('client.dashboard.discoverMenu')}
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
                <Store className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {t('client.home.noneTitle')}
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                {t('client.dashboard.noneText')}
              </p>
            </div>
          )}
        </div>

        {/* Section Historique Récents (Aperçu) */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Réservations */}
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Bed className="w-5 h-5 text-purple-600" />
                {t('client.dashboard.recentBookings')}
              </h3>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {bookings && bookings.length > 0 ? (
                bookings.slice(0, 5).map((b: any) => {
                  const isUpcoming = new Date(b.check_in) > new Date();
                  return (
                    <div key={b.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md hover:border-purple-100 transition-all duration-300">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-bold text-slate-800">{b.rooms?.structures?.name || t('client.dashboard.fallbackHotel')}</h4>
                        <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : b.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                          {t(`client.clientStatus.booking.${b.status}` as TranslationKey)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 flex items-center gap-2 mb-1">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        {format.date(b.check_in)} → {b.check_out ? format.date(b.check_out) : '?'}
                      </div>
                      {b.rooms?.price && (
                        <div className="text-sm font-bold text-purple-600 mt-2">
                          {t('client.dashboard.perNight', { amount: format.money(b.rooms.price) })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState icon={<CalendarDays className="w-8 h-8" />} message={t('client.dashboard.noRecentBookings')} />
              )}
            </div>
          </div>

          {/* Commandes */}
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                {t('client.dashboard.recentOrders')}
              </h3>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {orders && orders.length > 0 ? (
                orders.slice(0, 5).map((o: any) => (
                  <div key={o.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md hover:border-emerald-100 transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-bold text-slate-800">{o.structures?.name || t('client.dashboard.fallbackRestaurant')}</h4>
                      <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : o.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {t(`client.clientStatus.order.${o.status}` as TranslationKey)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {format.date(o.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
                      <div className="text-lg font-black text-emerald-600">
                        {format.money(o.total)}
                      </div>
                      <ClientInvoiceWrapper order={o} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon={<UtensilsCrossed className="w-8 h-8" />} message={t('client.dashboard.noRecentOrders')} />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Composants réutilisables améliorés
function StatCard({ icon, label, value, subValue, bgClass, iconColor, iconBg }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  bgClass: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className={`${bgClass} rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between`}>
      <div className="flex items-start justify-between mb-6">
        <div className={`p-3 rounded-2xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-3xl font-black text-slate-800 mb-1">{value}</div>
        <div className="text-sm font-bold text-slate-500 mb-0.5">{label}</div>
        <div className="text-xs font-medium text-slate-400">{subValue}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
      <div className="text-slate-300 mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}