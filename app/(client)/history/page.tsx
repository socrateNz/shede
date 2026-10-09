import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { ClientHistoryList } from '@/components/client-history-list';
import { CalendarDays, Clock } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { buildMeta, pageRange, parsePage, settlePage } from '@/lib/pagination';

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ bp?: string; op?: string }> }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const supabase = getAdminSupabase();
  const { t } = await getT();

  // 20 réservations et 20 commandes par page, chacune avec sa pagination ; totaux comptés par la base.
  const params = await searchParams;
  const bookingPage = parsePage(params.bp);
  const orderPage = parsePage(params.op);
  const [bFrom, bTo] = pageRange(bookingPage);
  const [oFrom, oTo] = pageRange(orderPage);
  const [{ data: bookings, count: bookingCount }, { data: orders, count: orderCount }] = await Promise.all([
    settlePage(supabase
      .from('bookings')
      .select('*, rooms(*, structures(*))', { count: 'exact' })
      .eq('client_id', session.userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(bFrom, bTo)),
    settlePage(supabase
      .from('orders')
      .select('*, structures(*), rooms(number), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))', { count: 'exact' })
      .or(`client_id.eq.${session.userId},user_id.eq.${session.userId}`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(oFrom, oTo)),
  ]);
  const bookingsMeta = buildMeta(bookingPage, bookingCount ?? 0, undefined);
  const ordersMeta = buildMeta(orderPage, orderCount ?? 0, undefined);

  const totalItems = bookingsMeta.total + ordersMeta.total;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10 space-y-6">

        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 rounded-2xl p-6 md:p-8 text-white overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                {t('client.history.title')}
              </h1>
              <p className="text-blue-100 text-sm md:text-base">
                {t('client.history.subtitle')}
              </p>
            </div>

            <div className="flex gap-2">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-bold">{totalItems}</div>
                <div className="text-xs text-blue-100">{t('client.history.elements')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <CalendarDays className="w-4 h-4" />
              <span className="text-xs font-medium">{t('client.history.bookings')}</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{bookingsMeta.total}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">{t('client.history.orders')}</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{ordersMeta.total}</div>
          </div>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">

              {t('client.history.details')}
            </h2>
          </div>
          <div className="p-6">
            <ClientHistoryList bookings={bookings || []} orders={orders || []} bookingsMeta={bookingsMeta} ordersMeta={ordersMeta} />
          </div>
        </div>
      </div>
    </div>
  );
}