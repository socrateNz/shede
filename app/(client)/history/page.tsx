import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { ClientHistoryList } from '@/components/client-history-list';

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const supabase = getAdminSupabase();

  // Fetch bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(*, structures(name))')
    .eq('client_id', session.userId)
    .order('created_at', { ascending: false });

  // Fetch orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*, structures(name), rooms(number), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
    .or(`client_id.eq.${session.userId},user_id.eq.${session.userId}`)
    .order('created_at', { ascending: false });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 mt-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mon Historique</h1>
        <p className="text-slate-500 mt-2">
          Gérez vos réservations d'hôtel et vos commandes en cours ou passées.
        </p>
      </div>

      <ClientHistoryList 
        bookings={bookings || []} 
        orders={orders || []} 
      />
    </div>
  );
}
