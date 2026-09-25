'use server';

import { getSession, type SessionPayload } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────
// Vue propriétaire (ORG_ADMIN) : statistiques consolidées de tous les
// points de l'organisation, ou d'un seul point via le filtre.
//
// Les définitions suivent celles déjà utilisées dans les points pour que
// les chiffres concordent :
// - CA restauration : commandes COMPLETED, datées par paid_at
//   (comme le tableau de bord et les sessions de caisse)
// - CA hôtel : réservations payées ou terminées, datées par updated_at
//   (comme le rapport Z)
// ─────────────────────────────────────────────────────────

export type OwnerRange = 'today' | '7' | '30' | '90';

const RANGES: OwnerRange[] = ['today', '7', '30', '90'];
const PAGE_SIZE = 1000; // plafond par réponse de PostgREST
const IN_CHUNK = 150; // taille des listes `in (...)` pour rester sous la limite d'URL
const ACTIVE_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED'];

type OwnerSession = SessionPayload & { organizationId: string };

async function requireOrgAdmin(): Promise<OwnerSession | null> {
  const session = await getSession();
  if (!session || session.role !== 'ORG_ADMIN' || !session.organizationId) return null;
  return session as OwnerSession;
}

/** Récupère toutes les lignes d'une requête, page par page. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Exécute une requête sur une longue liste d'ids, par paquets. */
async function fetchByIds<T>(
  ids: string[],
  build: (chunk: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    rows.push(...(await fetchAll<T>((from, to) => build(chunk, from, to))));
  }
  return rows;
}

function getPeriod(range: OwnerRange, now = new Date()) {
  const end = now;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = range === 'today' ? 1 : Number(range);
  start.setDate(start.getDate() - (days - 1));

  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - days);

  return { start, end, previousStart, days };
}

type Bucket = { key: string; label: string; start: number; end: number };

/** Tranches du graphique : par heure pour « aujourd'hui », sinon par jour. */
function buildBuckets(range: OwnerRange, start: Date, days: number): Bucket[] {
  if (range === 'today') {
    return Array.from({ length: 24 }, (_, hour) => {
      const from = new Date(start);
      from.setHours(hour, 0, 0, 0);
      return { key: `h${hour}`, label: `${hour}h`, start: from.getTime(), end: from.getTime() + 3600_000 };
    });
  }
  return Array.from({ length: days }, (_, i) => {
    const from = new Date(start);
    from.setDate(from.getDate() + i);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return {
      key: from.toISOString().slice(0, 10),
      label: from.toLocaleDateString('fr-FR', days > 14 ? { day: '2-digit', month: '2-digit' } : { weekday: 'short', day: '2-digit' }),
      start: from.getTime(),
      end: to.getTime(),
    };
  });
}

function mostCommon(values: (string | null | undefined)[], fallback: string) {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

type OrderRow = {
  id: string;
  structure_id: string;
  total: number | null;
  discount_amount: number | null;
  tip_amount: number | null;
  paid_at: string;
  source: string | null;
  consumption_type: string | null;
};

type BookingRow = {
  total_amount: number | null;
  updated_at: string;
  rooms: { structure_id: string } | { structure_id: string }[] | null;
};

function bookingPointId(booking: BookingRow): string | undefined {
  const room = Array.isArray(booking.rooms) ? booking.rooms[0] : booking.rooms;
  return room?.structure_id;
}

export async function getOwnerDashboard(params: { range?: string; pointId?: string }) {
  const session = await requireOrgAdmin();
  if (!session) return null;

  const range: OwnerRange = RANGES.includes(params.range as OwnerRange)
    ? (params.range as OwnerRange)
    : '30';

  const admin = getAdminSupabase();

  const [{ data: organization }, { data: allPoints }] = await Promise.all([
    admin.from('organizations').select('id, name').eq('id', session.organizationId).maybeSingle(),
    admin
      .from('structures')
      .select('id, name, is_active, currency')
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: true }),
  ]);

  if (!organization) return null;

  const points = allPoints || [];
  const selectedPoint = points.find((p) => p.id === params.pointId) ?? null;
  const scope = selectedPoint ? [selectedPoint] : points;
  const scopeIds = scope.map((p) => p.id);
  const currency = mostCommon(points.map((p) => p.currency), 'XOF');
  const mixedCurrencies = new Set(points.map((p) => p.currency || 'XOF')).size > 1;

  const { start, end, previousStart, days } = getPeriod(range);
  const startIso = start.toISOString();
  const buckets = buildBuckets(range, start, days);

  const base = {
    organization,
    points: points.map(({ id, name, is_active }) => ({ id, name, is_active })),
    range,
    pointId: selectedPoint?.id ?? null,
    currency,
    mixedCurrencies,
    period: { start: startIso, end: end.toISOString() },
  };

  if (scopeIds.length === 0) {
    return { ...base, empty: true as const };
  }

  // ── Données de la période courante + précédente ──
  const [orders, bookings, cancelledCount, activeOrders, openShifts, closedShifts, stocks] =
    await Promise.all([
      fetchAll<OrderRow>((from, to) =>
        admin
          .from('orders')
          .select('id, structure_id, total, discount_amount, tip_amount, paid_at, source, consumption_type')
          .in('structure_id', scopeIds)
          .eq('status', 'COMPLETED')
          .gte('paid_at', previousStart.toISOString())
          .lte('paid_at', end.toISOString())
          .order('paid_at', { ascending: true })
          .range(from, to)
      ),
      fetchAll<BookingRow>((from, to) =>
        admin
          .from('bookings')
          .select('total_amount, updated_at, rooms!inner(structure_id)')
          .in('rooms.structure_id', scopeIds)
          .or('status.eq.COMPLETED,is_paid.eq.true')
          .gte('updated_at', previousStart.toISOString())
          .lte('updated_at', end.toISOString())
          .range(from, to)
      ),
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('structure_id', scopeIds)
        .eq('status', 'CANCELLED')
        .gte('created_at', startIso)
        .then((r) => r.count ?? 0),
      fetchAll<{ structure_id: string; status: string }>((from, to) =>
        admin
          .from('orders')
          .select('structure_id, status')
          .in('structure_id', scopeIds)
          .in('status', ACTIVE_ORDER_STATUSES)
          .range(from, to)
      ),
      admin
        .from('shifts')
        .select('id, structure_id, opened_at, opening_balance, users(first_name, last_name)')
        .in('structure_id', scopeIds)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: true })
        .then((r) => r.data || []),
      fetchAll<{ structure_id: string; expected_amount: number | null; actual_amount: number | null; difference: number | null }>(
        (from, to) =>
          admin
            .from('shifts')
            .select('structure_id, expected_amount, actual_amount, difference')
            .in('structure_id', scopeIds)
            .eq('status', 'CLOSED')
            .gte('closed_at', startIso)
            .range(from, to)
      ),
      fetchAll<any>((from, to) =>
        admin
          .from('stocks')
          .select('id, structure_id, quantity, threshold, products(name, is_deleted), accompaniments(name, is_deleted)')
          .in('structure_id', scopeIds)
          .range(from, to)
      ),
    ]);

  const startMs = start.getTime();
  const isCurrent = (iso: string) => new Date(iso).getTime() >= startMs;

  const currentOrders = orders.filter((o) => isCurrent(o.paid_at));
  const previousOrders = orders.filter((o) => !isCurrent(o.paid_at));
  const currentBookings = bookings.filter((b) => isCurrent(b.updated_at));
  const previousBookings = bookings.filter((b) => !isCurrent(b.updated_at));

  const sum = <T>(rows: T[], pick: (row: T) => number | null | undefined) =>
    rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

  const orderRevenue = sum(currentOrders, (o) => o.total);
  const hotelRevenue = sum(currentBookings, (b) => b.total_amount);
  const previousOrderRevenue = sum(previousOrders, (o) => o.total);
  const previousHotelRevenue = sum(previousBookings, (b) => b.total_amount);

  const kpis = {
    revenue: orderRevenue + hotelRevenue,
    previousRevenue: previousOrderRevenue + previousHotelRevenue,
    orderRevenue,
    hotelRevenue,
    ordersCount: currentOrders.length,
    previousOrdersCount: previousOrders.length,
    avgTicket: currentOrders.length ? orderRevenue / currentOrders.length : 0,
    previousAvgTicket: previousOrders.length ? previousOrderRevenue / previousOrders.length : 0,
    discounts: sum(currentOrders, (o) => o.discount_amount),
    tips: sum(currentOrders, (o) => o.tip_amount),
    bookingsCount: currentBookings.length,
    cancelledCount,
  };

  // ── Évolution du CA (empilée par point) ──
  const series = buckets.map((bucket) => {
    const row: Record<string, number | string> = { key: bucket.key, label: bucket.label };
    for (const point of scope) row[point.id] = 0;
    return row;
  });
  const bucketIndex = (iso: string) => {
    const t = new Date(iso).getTime();
    return buckets.findIndex((b) => t >= b.start && t < b.end);
  };
  for (const o of currentOrders) {
    const i = bucketIndex(o.paid_at);
    if (i >= 0) series[i][o.structure_id] = (series[i][o.structure_id] as number) + (Number(o.total) || 0);
  }
  for (const b of currentBookings) {
    const pointId = bookingPointId(b);
    const i = bucketIndex(b.updated_at);
    if (i >= 0 && pointId && pointId in series[i]) {
      series[i][pointId] = (series[i][pointId] as number) + (Number(b.total_amount) || 0);
    }
  }

  // ── Heures de pointe (commandes encaissées) ──
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour: `${hour}h`, revenue: 0, orders: 0 }));
  for (const o of currentOrders) {
    const h = new Date(o.paid_at).getHours();
    byHour[h].revenue += Number(o.total) || 0;
    byHour[h].orders += 1;
  }

  // ── Canaux de vente ──
  const channelLabel = (o: OrderRow) => {
    if (o.source === 'CLIENT') return 'Application client';
    if (o.source && o.source !== 'CAISSE') return o.source;
    return o.consumption_type === 'TAKEAWAY' ? 'À emporter' : 'Sur place';
  };
  const channelsMap = new Map<string, { amount: number; count: number }>();
  for (const o of currentOrders) {
    const key = channelLabel(o);
    const entry = channelsMap.get(key) ?? { amount: 0, count: 0 };
    entry.amount += Number(o.total) || 0;
    entry.count += 1;
    channelsMap.set(key, entry);
  }
  if (hotelRevenue > 0) channelsMap.set('Hébergement', { amount: hotelRevenue, count: currentBookings.length });
  const channels = [...channelsMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // ── Moyens de paiement & top produits (commandes de la période) ──
  const currentOrderIds = currentOrders.map((o) => o.id);
  const [payments, items] = await Promise.all([
    fetchByIds<{ amount: number; payment_method: string | null }>(currentOrderIds, (chunk, from, to) =>
      admin
        .from('payments')
        .select('amount, payment_method')
        .in('order_id', chunk)
        .eq('status', 'COMPLETED')
        .range(from, to)
    ),
    fetchByIds<any>(currentOrderIds, (chunk, from, to) =>
      admin
        .from('order_items')
        .select('quantity, total_price, is_price_counted, parent_order_item_id, products(name)')
        .in('order_id', chunk)
        .range(from, to)
    ),
  ]);

  const methodsMap = new Map<string, number>();
  for (const p of payments) {
    const method = p.payment_method || 'AUTRE';
    methodsMap.set(method, (methodsMap.get(method) ?? 0) + (Number(p.amount) || 0));
  }
  const paymentMethods = [...methodsMap.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  const productsMap = new Map<string, { quantity: number; revenue: number }>();
  for (const item of items) {
    if (item.parent_order_item_id) continue; // composants d'un menu : comptés via le produit parent
    const name = item.products?.name || 'Produit supprimé';
    const entry = productsMap.get(name) ?? { quantity: 0, revenue: 0 };
    entry.quantity += Number(item.quantity) || 0;
    if (item.is_price_counted !== false) entry.revenue += Number(item.total_price) || 0;
    productsMap.set(name, entry);
  }
  const topProducts = [...productsMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 10);

  // ── Stock bas ──
  const pointName = new Map(points.map((p) => [p.id, p.name]));
  const lowStock = stocks
    .filter((s) => {
      const item = s.products ?? s.accompaniments;
      return item && !item.is_deleted && Number(s.quantity) <= Number(s.threshold ?? 5);
    })
    .map((s) => ({
      id: s.id as string,
      pointId: s.structure_id as string,
      point: pointName.get(s.structure_id) ?? '—',
      name: (s.products?.name ?? s.accompaniments?.name) as string,
      quantity: Number(s.quantity),
      threshold: Number(s.threshold ?? 5),
    }))
    .sort((a, b) => a.quantity - b.quantity);

  // ── Caisse ──
  const cash = {
    closedCount: closedShifts.length,
    expected: sum(closedShifts, (s) => s.expected_amount),
    actual: sum(closedShifts, (s) => s.actual_amount),
    difference: sum(closedShifts, (s) => s.difference),
    negativeCount: closedShifts.filter((s) => Number(s.difference) < 0).length,
    open: openShifts.map((s: any) => ({
      id: s.id as string,
      point: pointName.get(s.structure_id) ?? '—',
      cashier: [s.users?.first_name, s.users?.last_name].filter(Boolean).join(' ') || '—',
      openedAt: s.opened_at as string,
      openingBalance: Number(s.opening_balance) || 0,
    })),
  };

  // ── Comparatif par point ──
  const perPoint = scope.map((point) => {
    const pOrders = currentOrders.filter((o) => o.structure_id === point.id);
    const pOrderRevenue = sum(pOrders, (o) => o.total);
    const pHotelRevenue = sum(
      currentBookings.filter((b) => bookingPointId(b) === point.id),
      (b) => b.total_amount
    );
    const pPrevious =
      sum(previousOrders.filter((o) => o.structure_id === point.id), (o) => o.total) +
      sum(previousBookings.filter((b) => bookingPointId(b) === point.id), (b) => b.total_amount);
    const pShifts = closedShifts.filter((s) => s.structure_id === point.id);
    const revenue = pOrderRevenue + pHotelRevenue;

    return {
      id: point.id,
      name: point.name,
      isActive: point.is_active !== false,
      revenue,
      previousRevenue: pPrevious,
      orderRevenue: pOrderRevenue,
      hotelRevenue: pHotelRevenue,
      orders: pOrders.length,
      avgTicket: pOrders.length ? pOrderRevenue / pOrders.length : 0,
      share: kpis.revenue > 0 ? revenue / kpis.revenue : 0,
      activeOrders: activeOrders.filter((o) => o.structure_id === point.id).length,
      openShifts: openShifts.filter((s: any) => s.structure_id === point.id).length,
      cashDifference: sum(pShifts, (s) => s.difference),
      lowStock: lowStock.filter((s) => s.pointId === point.id).length,
    };
  });

  return {
    ...base,
    empty: false as const,
    scopePoints: scope.map(({ id, name }) => ({ id, name })),
    kpis,
    series,
    byHour,
    channels,
    paymentMethods,
    topProducts,
    perPoint,
    cash,
    activeOrdersCount: activeOrders.length,
    lowStock: lowStock.slice(0, 20),
    lowStockCount: lowStock.length,
  };
}

export type OwnerDashboard = NonNullable<Awaited<ReturnType<typeof getOwnerDashboard>>>;

/** Historique des sessions de caisse de tous les points (ou d'un point). */
export async function getOwnerShifts(params: { pointId?: string; status?: string }) {
  const session = await requireOrgAdmin();
  if (!session) return null;

  const admin = getAdminSupabase();
  const { data: points } = await admin
    .from('structures')
    .select('id, name')
    .eq('organization_id', session.organizationId)
    .order('created_at', { ascending: true });

  const allPoints = points || [];
  const selected = allPoints.find((p) => p.id === params.pointId) ?? null;
  const scopeIds = selected ? [selected.id] : allPoints.map((p) => p.id);
  const status = params.status === 'OPEN' || params.status === 'CLOSED' ? params.status : null;

  const shifts = scopeIds.length
    ? await fetchAll<any>((from, to) => {
        let query = admin
          .from('shifts')
          .select('*, users(first_name, last_name)')
          .in('structure_id', scopeIds)
          .order('opened_at', { ascending: false });
        if (status) query = query.eq('status', status);
        return query.range(from, to);
      })
    : [];

  const pointName = new Map(allPoints.map((p) => [p.id, p.name]));

  return {
    points: allPoints,
    pointId: selected?.id ?? null,
    status,
    shifts: shifts.map((s) => ({ ...s, pointName: pointName.get(s.structure_id) ?? '—' })),
  };
}
