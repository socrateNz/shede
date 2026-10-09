'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';

export type SidebarCounts = {
  /** Nouvelles commandes (PENDING). */
  orders: number;
  /** Commandes pas encore encaissées (le paiement les passe en COMPLETED). */
  unpaidOrders: number;
  /** Commandes prêtes à servir (pour un serveur : les siennes). */
  readyOrders: number;
  /** Commandes à préparer en cuisine / au bar. */
  kitchen: number;
  bar: number;
  /** Livraisons à attribuer (pour un livreur : à prendre + les siennes en cours). */
  deliveries: number;
  stock: number;
  /** Inventaires commencés, pas encore validés. */
  inventories: number;
  /** Bons de commande fournisseur en brouillon (à envoyer) / envoyés pas encore reçus. */
  purchaseDrafts: number;
  purchasePending: number;
  bookings: number;
  /** Chambres à nettoyer. */
  roomsCleaning: number;
  /** Dépenses à payer. */
  unpaidExpenses: number;
  notifications: number;
};

const EMPTY: SidebarCounts = {
  orders: 0,
  unpaidOrders: 0,
  readyOrders: 0,
  kitchen: 0,
  bar: 0,
  deliveries: 0,
  stock: 0,
  inventories: 0,
  purchaseDrafts: 0,
  purchasePending: 0,
  bookings: 0,
  roomsCleaning: 0,
  unpaidExpenses: 0,
  notifications: 0,
};

/** Compteurs de la barre latérale : seulement ceux que le rôle voit et que la licence couvre. */
export async function getSidebarCounts(): Promise<SidebarCounts> {
  const session = await getSession();
  if (!session?.structureId) return EMPTY;

  const admin = getAdminSupabase();
  const structureId = session.structureId;
  const role = session.role;
  const has = (module: string) => Boolean(session.modules?.includes(module));
  const can = (...roles: string[]) => roles.includes(role);
  const orders = () => admin.from('orders').select('id', { count: 'exact', head: true }).eq('structure_id', structureId);
  const count = async (enabled: boolean, query: () => PromiseLike<{ count: number | null; error: unknown }>) => {
    if (!enabled) return 0;
    const { count, error } = await query();
    if (error) console.error('[sidebar]', error);
    return count ?? 0;
  };
  // Commandes avec des plats partis vers un poste (cuisine ou bar), pas encore prêtes
  const station = (destination: 'CUISINE' | 'BAR', column: 'kitchen_status' | 'bar_status') => () =>
    admin
      .from('orders')
      .select('id, order_items!inner(held, products!inner(destination))', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .or(`${column}.is.null,${column}.in.(PENDING,IN_PROGRESS)`)
      .eq('order_items.held', false)
      .eq('order_items.products.destination', destination);

  try {
    const [
      ordersCount,
      unpaidOrders,
      readyOrders,
      kitchen,
      bar,
      deliveries,
      inventories,
      purchaseDrafts,
      purchasePending,
      bookings,
      roomsCleaning,
      unpaidExpenses,
      notifications,
      stock,
    ] = await Promise.all([
      count(has('POS') && can('ADMIN', 'CAISSE', 'SERVEUR'), () => orders().eq('status', 'PENDING')),
      count(has('POS') && can('ADMIN', 'CAISSE', 'SERVEUR'), () => orders().not('status', 'in', '(COMPLETED,CANCELLED)')),
      count(has('POS') && can('ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR'), () => {
        const q = orders().eq('status', 'READY');
        return role === 'SERVEUR' ? q.eq('user_id', session.userId) : q;
      }),
      count(has('CUISINE') && can('ADMIN', 'MANAGER', 'CUISINIER'), station('CUISINE', 'kitchen_status')),
      count(has('BAR') && can('ADMIN', 'MANAGER', 'BAR'), station('BAR', 'bar_status')),
      count(has('LIVRAISON') && can('ADMIN', 'MANAGER', 'LIVREUR'), () => {
        const q = orders().eq('consumption_type', 'DELIVERY').neq('status', 'CANCELLED');
        return role === 'LIVREUR'
          ? q.or(`delivery_status.eq.TO_ASSIGN,and(courier_id.eq.${session.userId},delivery_status.in.(ASSIGNED,IN_TRANSIT))`)
          : q.eq('delivery_status', 'TO_ASSIGN');
      }),
      count(has('STOCK') && can('ADMIN', 'MANAGER', 'MAGASINIER'), () =>
        admin.from('inventories').select('id', { count: 'exact', head: true }).eq('structure_id', structureId).eq('status', 'DRAFT'),
      ),
      count(has('ACHATS') && can('ADMIN', 'MANAGER', 'MAGASINIER'), () =>
        admin.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('structure_id', structureId).eq('status', 'DRAFT'),
      ),
      count(has('ACHATS') && can('ADMIN', 'MANAGER', 'MAGASINIER'), () =>
        admin.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('structure_id', structureId).in('status', ['SENT', 'PARTIAL']),
      ),
      count(has('HOTEL') && can('ADMIN', 'RECEPTION'), () =>
        admin
          .from('bookings')
          .select('id, rooms!inner(structure_id)', { count: 'exact', head: true })
          .eq('rooms.structure_id', structureId)
          .eq('status', 'PENDING'),
      ),
      count(has('HOTEL') && can('ADMIN', 'RECEPTION'), () =>
        admin.from('rooms').select('id', { count: 'exact', head: true }).eq('structure_id', structureId).eq('status', 'CLEANING'),
      ),
      count(has('COMPTABILITE') && can('ADMIN', 'COMPTABLE', 'MANAGER'), () =>
        admin.from('expenses').select('id', { count: 'exact', head: true }).eq('structure_id', structureId).eq('status', 'UNPAID'),
      ),
      count(true, () =>
        admin
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.userId)
          .eq('structure_id', structureId)
          .eq('is_read', false),
      ),
      has('STOCK') && can('ADMIN', 'MANAGER', 'MAGASINIER') ? countLowStock(structureId) : 0,
    ]);

    return {
      orders: ordersCount,
      unpaidOrders,
      readyOrders,
      kitchen,
      bar,
      deliveries,
      stock,
      inventories,
      purchaseDrafts,
      purchasePending,
      bookings,
      roomsCleaning,
      unpaidExpenses,
      notifications,
    };
  } catch (error) {
    console.error('Error fetching sidebar counts:', error);
    return EMPTY;
  }
}

/**
 * Produits et accompagnements dont le stock est sous le seuil.
 * Un article sans ligne dans `stocks` compte comme quantité 0 (sous n'importe quel seuil).
 */
async function countLowStock(structureId: string) {
  const admin = getAdminSupabase();
  const [{ data: productsData }, { data: accompData }] = await Promise.all([
    admin.from('products').select('id, stocks(quantity, threshold)').eq('structure_id', structureId).eq('is_deleted', false),
    admin
      .from('accompaniments')
      .select('id, stocks(quantity, threshold)')
      .eq('structure_id', structureId)
      .eq('is_deleted', false)
      .eq('is_available', true),
  ]);
  return [...(productsData || []), ...(accompData || [])].filter((item: any) => {
    const stock = item.stocks?.[0];
    return (stock?.quantity ?? 0) <= (stock?.threshold ?? 5);
  }).length;
}
