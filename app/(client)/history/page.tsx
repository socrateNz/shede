import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { ClientHistoryList } from '@/components/client-history-list';
import { CalendarDays, Clock, History, Sparkles } from 'lucide-react';

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const supabase = getAdminSupabase();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(*, structures(name))')
    .eq('client_id', session.userId)
    .order('created_at', { ascending: false });

  const { data: orders } = await supabase
    .from('orders')
    .select('*, structures(name), rooms(number), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
    .or(`client_id.eq.${session.userId},user_id.eq.${session.userId}`)
    .order('created_at', { ascending: false });

  const totalItems = (bookings?.length || 0) + (orders?.length || 0);

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
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-3">
                <History className="w-4 h-4" />
                <span className="text-sm font-medium">Historique complet</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                Mon Historique
              </h1>
              <p className="text-blue-100 text-sm md:text-base">
                Gérez vos réservations et commandes passées
              </p>
            </div>

            <div className="flex gap-2">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-bold">{totalItems}</div>
                <div className="text-xs text-blue-100">Élément(s)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <CalendarDays className="w-4 h-4" />
              <span className="text-xs font-medium">Réservations</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{bookings?.length || 0}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Commandes</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{orders?.length || 0}</div>
          </div>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Détails
            </h2>
          </div>
          <div className="p-6">
            <ClientHistoryList
              bookings={bookings || []}
              orders={orders || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}