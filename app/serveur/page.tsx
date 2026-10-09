import { redirect } from 'next/navigation';
import { requireRole } from '@/app/actions/auth';
import { getWaiterFloor, getWaiterMenu, getWaiterOrders } from '@/app/actions/waiter';
import { WaiterApp } from '@/components/waiter/waiter-app';
import { getAdminSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function WaiterPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR');
  const [floor, menu, orders, { data: me }] = await Promise.all([
    getWaiterFloor(),
    getWaiterMenu(),
    getWaiterOrders(),
    getAdminSupabase().from('users').select('first_name, last_name').eq('id', session.userId).maybeSingle(),
  ]);
  // Sans point ou sans le module Caisse : pas de mode serveur
  if (!floor || !menu || !orders) redirect('/unauthorized');

  const name = [me?.first_name, me?.last_name].filter(Boolean).join(' ') || session.email;
  const initials = (me?.first_name?.[0] ?? '') + (me?.last_name?.[0] ?? me?.first_name?.[1] ?? '');

  return (
    <WaiterApp
      me={{ id: session.userId, name: me?.first_name || name, initials: initials.toUpperCase() || 'S' }}
      initialFloor={floor}
      menu={menu}
      initialOrders={orders}
      pinSession={Boolean(session.pin)}
    />
  );
}
