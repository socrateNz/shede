'use server';

import { getSession, type SessionPayload } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { recomputeOrderTotal } from '@/lib/order-totals';
import { getStructureActiveShift } from '@/lib/shifts-server';
import { notifyStructureStaff } from '@/lib/notifications';
import { categoryIdsByProduct, loadCategories } from '@/lib/categories';
import { addDays, localToday } from '@/lib/forecast';
import { fetchAll } from '@/lib/pagination';

// Mode serveur (docs/phase22-waiter.sql) : plan de salle, prise de commande sur téléphone,
// envoi en deux temps et suivi. Toujours le point de la session, jamais un identifiant de
// point envoyé par le navigateur ; prix et produits relus en base.

const WAITER_ROLES = ['SERVEUR', 'ADMIN', 'CAISSE', 'MANAGER', 'SUPER_ADMIN'];
const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED'];
const MAX_LINES = 60;
const MAX_QTY = 99;
const MAX_NOTE = 140;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type WaiterSession = SessionPayload & { structureId: string };

async function requireWaiter(): Promise<WaiterSession | null> {
  const session = await getSession();
  if (!session?.structureId || !WAITER_ROLES.includes(session.role)) return null;
  if (!session.modules?.includes('POS')) return null;
  return session as WaiterSession;
}

const fullName = (u: { first_name?: string | null; last_name?: string | null } | null | undefined) =>
  u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : '';

// ── Plan de salle ─────────────────────────────────────────

export type WaiterGroup = {
  orderId: string;
  covers: number | null;
  status: string;
  waiterName: string;
  mine: boolean;
  heldCount: number;
  total: number;
  openedAt: string;
};

export type WaiterTable = {
  id: string;
  name: string;
  floorId: string;
  capacity: number;
  shape: 'round' | 'square' | 'rectangle';
  /** Disposition de l'éditeur de plan de salle (px). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Un groupe = une commande ouverte, avec ses couverts. */
  groups: WaiterGroup[];
  seatsTaken: number;
  /** Places encore libres (capacité − couverts des groupes) ; jamais négatif. */
  seatsFree: number;
};

export type WaiterFloorPlan = { floors: { id: string; name: string }[]; tables: WaiterTable[]; registerOpen: boolean };

/** Salles, tables (disposition de l'éditeur) et, pour chaque table, ses groupes en cours. */
export async function getWaiterFloor(): Promise<WaiterFloorPlan | null> {
  const session = await requireWaiter();
  if (!session) return null;
  const admin = getAdminSupabase();
  const [{ data: floors }, { data: tables }, openOrders, shift] = await Promise.all([
    admin.from('floors').select('id, name').eq('structure_id', session.structureId).order('name'),
    admin.from('tables').select('id, name, capacity, shape, position_x, position_y, width, height, floor_name, floor_id').eq('structure_id', session.structureId),
    fetchAll<any>((from, to) =>
      admin
        .from('orders')
        .select('id, table_id, covers, status, user_id, total, created_at, users!user_id(first_name, last_name), order_items(held)')
        .eq('structure_id', session.structureId)
        .not('table_id', 'is', null)
        .in('status', OPEN_STATUSES)
        .order('created_at', { ascending: true })
        .order('id')
        .range(from, to),
    ),
    getStructureActiveShift(session.structureId),
  ]);

  const groupsByTable = new Map<string, WaiterGroup[]>();
  for (const o of openOrders) {
    const list = groupsByTable.get(o.table_id) ?? [];
    list.push({
      orderId: o.id,
      covers: o.covers ?? null,
      status: o.status,
      waiterName: fullName(o.users),
      mine: o.user_id === session.userId,
      heldCount: (o.order_items || []).filter((i: any) => i.held).length,
      total: Number(o.total) || 0,
      openedAt: o.created_at,
    });
    groupsByTable.set(o.table_id, list);
  }

  // Salles : celles de l'éditeur ; une table sans salle connue rejoint la salle de même nom, sinon la première
  const floorList = (floors || []).map((f: any) => ({ id: f.id as string, name: f.name as string }));
  const floorIdOf = (t: any) =>
    (t.floor_id && floorList.some((f) => f.id === t.floor_id) && t.floor_id) || floorList.find((f) => f.name === t.floor_name)?.id || floorList[0]?.id || 'default';
  if (!floorList.length) floorList.push({ id: 'default', name: '' });

  const collator = new Intl.Collator('fr', { numeric: true });
  const list: WaiterTable[] = (tables || [])
    .map((t: any) => {
      const groups = groupsByTable.get(t.id) ?? [];
      const capacity = Math.max(0, Number(t.capacity) || 0);
      const seatsTaken = groups.reduce((n, g) => n + (g.covers ?? 0), 0);
      return {
        id: t.id as string,
        name: t.name as string,
        floorId: floorIdOf(t),
        capacity,
        shape: (['round', 'square', 'rectangle'].includes(t.shape) ? t.shape : 'square') as WaiterTable['shape'],
        x: Number(t.position_x) || 0,
        y: Number(t.position_y) || 0,
        w: Math.max(40, Number(t.width) || 100),
        h: Math.max(40, Number(t.height) || 100),
        groups,
        seatsTaken,
        seatsFree: Math.max(0, capacity - seatsTaken),
      };
    })
    .sort((x, y) => collator.compare(x.name, y.name));

  return { floors: floorList, tables: list, registerOpen: Boolean(shift) };
}

// ── Carte ────────────────────────────────────────────────

export type WaiterMenu = {
  categories: { id: string; name: string; parentId: string | null }[];
  products: {
    id: string;
    name: string;
    price: number;
    station: 'CUISINE' | 'BAR';
    categoryIds: string[];
    accompaniments: { id: string; name: string; price: number; quantity: number }[];
  }[];
  /** Les plus vendus sur 30 jours (ordre décroissant). */
  favorites: string[];
};

/** Produits disponibles du point, avec catégories, accompagnements possibles et favoris. */
export async function getWaiterMenu(): Promise<WaiterMenu | null> {
  const session = await requireWaiter();
  if (!session) return null;
  const admin = getAdminSupabase();

  const products = await fetchAll<any>((from, to) =>
    admin
      .from('products')
      .select('id, name, price, destination')
      .eq('structure_id', session.structureId)
      .eq('is_deleted', false)
      .eq('is_available', true)
      .order('name')
      .order('id')
      .range(from, to),
  );
  const ids = products.map((p) => p.id as string);
  const today = localToday();

  const [categories, links, mappings, sales] = await Promise.all([
    loadCategories(session.structureId, { activeOnly: true }),
    categoryIdsByProduct(ids),
    ids.length
      ? fetchAll<any>((from, to) =>
          admin
            .from('product_accompaniments')
            .select('product_id, quantity, accompaniments!inner(id, name, price, is_available, is_deleted, structure_id)')
            .in('product_id', ids)
            .eq('accompaniments.structure_id', session.structureId)
            .order('product_id')
            .range(from, to),
        )
      : Promise.resolve([]),
    fetchAll<any>((from, to) =>
      admin
        .rpc('daily_product_sales', { p_structure_id: session.structureId, p_from: addDays(today, -30), p_to: today })
        .order('day')
        .order('product_id')
        .range(from, to),
    ).catch(() => []),
  ]);

  const accByProduct = new Map<string, WaiterMenu['products'][number]['accompaniments']>();
  for (const m of mappings) {
    const a = m.accompaniments;
    if (!a || !a.is_available || a.is_deleted) continue;
    const list = accByProduct.get(m.product_id) ?? [];
    list.push({ id: a.id, name: a.name, price: Number(a.price) || 0, quantity: Number(m.quantity) || 1 });
    accByProduct.set(m.product_id, list);
  }

  const sold = new Map<string, number>();
  for (const r of sales) sold.set(r.product_id, (sold.get(r.product_id) ?? 0) + (Number(r.quantity) || 0));
  const favorites = [...sold.entries()]
    .filter(([id]) => ids.includes(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);

  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
      station: p.destination === 'BAR' ? 'BAR' : 'CUISINE',
      categoryIds: links.get(p.id) ?? [],
      accompaniments: accByProduct.get(p.id) ?? [],
    })),
    favorites,
  };
}

// ── Envoi d'une commande ─────────────────────────────────

export type WaiterOrderInput = {
  /** Identifiant unique créé sur le téléphone : un envoi répété n'est traité qu'une fois. */
  ref: string;
  tableId: string;
  /** Groupe (commande ouverte) auquel ajouter ; absent = nouveau groupe à la table. */
  orderId?: string | null;
  /** Couverts du nouveau groupe (dans la limite des places libres de la table). */
  covers?: number | null;
  items: {
    productId: string;
    quantity: number;
    note?: string | null;
    /** En attente : partira en cuisine au signal du serveur (envoi en deux temps). */
    held?: boolean;
    accompaniments?: string[];
  }[];
};

type SubmitResult = { success: true; orderId: string; duplicate?: boolean } | { success: false; error: string };

/**
 * Ajoute les lignes au groupe choisi (orderId), ou ouvre un nouveau groupe à la table dans la
 * limite de ses places libres. Idempotent
 * grâce à `ref` (table order_submissions) : un double appui ou une file hors ligne
 * renvoyée ne crée pas de doublon.
 */
export async function submitWaiterOrder(input: WaiterOrderInput): Promise<SubmitResult> {
  const session = await requireWaiter();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (!input || typeof input.ref !== 'string' || !UUID.test(input.ref) || typeof input.tableId !== 'string') {
    return { success: false, error: await te('errors.invalidOrderItems') };
  }

  // Lignes : quantités entières, notes courtes ; jamais de prix venant du navigateur
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length || items.length > MAX_LINES) return { success: false, error: await te('errors.addAtLeastOneProduct') };
  const lines = items.map((i) => ({
    productId: String(i?.productId ?? ''),
    quantity: Number(i?.quantity),
    note: typeof i?.note === 'string' ? i.note.trim().slice(0, MAX_NOTE) : '',
    held: Boolean(i?.held),
    accompaniments: [...new Set((Array.isArray(i?.accompaniments) ? i.accompaniments : []).map(String))],
  }));
  if (lines.some((l) => !UUID.test(l.productId) || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QTY)) {
    return { success: false, error: await te('errors.productsUnavailable') };
  }
  const covers = input.covers == null ? null : Number(input.covers);
  if (covers !== null && (!Number.isInteger(covers) || covers < 1 || covers > 99)) {
    return { success: false, error: await te('errors.invalidOrderItems') };
  }

  const admin = getAdminSupabase();
  if (!(await getStructureActiveShift(session.structureId))) return { success: false, error: await te('errors.registerClosed') };

  const { data: table } = await admin.from('tables').select('id, name, capacity').eq('id', input.tableId).eq('structure_id', session.structureId).maybeSingle();
  if (!table) return { success: false, error: await te('errors.unauthorized') };

  // Produits du point, disponibles ; prix de la base
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const { data: products } = await admin
    .from('products')
    .select('id, price, destination')
    .eq('structure_id', session.structureId)
    .eq('is_deleted', false)
    .eq('is_available', true)
    .in('id', productIds);
  const productById = new Map((products || []).map((p: any) => [p.id as string, p]));
  if (productById.size !== productIds.length) return { success: false, error: await te('errors.productsUnavailable') };

  // Accompagnements : rattachés au produit, du point, disponibles ; prix et quantité de la base
  const accIds = [...new Set(lines.flatMap((l) => l.accompaniments))];
  const accPrice = new Map<string, number>();
  const accMultiplier = new Map<string, number>();
  if (accIds.length) {
    const [{ data: accRows }, { data: maps }] = await Promise.all([
      admin.from('accompaniments').select('id, price').eq('structure_id', session.structureId).eq('is_available', true).eq('is_deleted', false).in('id', accIds),
      admin.from('product_accompaniments').select('product_id, accompaniment_id, quantity').in('product_id', productIds).in('accompaniment_id', accIds),
    ]);
    for (const a of accRows || []) accPrice.set(a.id as string, Number(a.price) || 0);
    for (const m of maps || []) accMultiplier.set(`${m.product_id}:${m.accompaniment_id}`, Number(m.quantity) || 1);
    if (lines.some((l) => l.accompaniments.some((a) => !accPrice.has(a) || !accMultiplier.has(`${l.productId}:${a}`)))) {
      return { success: false, error: await te('errors.accompanimentsUnavailable') };
    }
  }

  // Anti-doublon : la clé primaire refuse un second envoi du même `ref`
  const { error: refError } = await admin.from('order_submissions').insert({ ref: input.ref, structure_id: session.structureId, created_by: session.userId });
  if (refError) {
    if (refError.code === '23505') {
      const { data: prior } = await admin.from('order_submissions').select('order_id').eq('ref', input.ref).eq('structure_id', session.structureId).maybeSingle();
      if (prior?.order_id) return { success: true, orderId: prior.order_id as string, duplicate: true };
      return { success: false, error: await te('errors.orderCreateFailed') }; // envoi identique encore en cours
    }
    console.error('[waiter] submission:', refError.message);
    return { success: false, error: await te('errors.orderCreateFailed') };
  }
  const releaseRef = () => admin.from('order_submissions').delete().eq('ref', input.ref);

  let createdOrderId: string | null = null;
  try {
    // Groupe existant (commande ouverte de cette table) ou nouveau groupe
    let open: { id: string; status: string; covers: number | null } | null = null;
    if (input.orderId) {
      const { data } = await admin
        .from('orders')
        .select('id, status, covers')
        .eq('id', input.orderId)
        .eq('structure_id', session.structureId)
        .eq('table_id', table.id)
        .in('status', OPEN_STATUSES)
        .maybeSingle();
      if (!data) {
        await releaseRef();
        return { success: false, error: await te('errors.orderNotFound') };
      }
      open = data as { id: string; status: string; covers: number | null };
    } else if (covers) {
      // Places libres : capacité − couverts des groupes en cours (relu ici, pour deux téléphones simultanés)
      const capacity = Number(table.capacity) || 0;
      const { data: groups } = await admin.from('orders').select('covers').eq('structure_id', session.structureId).eq('table_id', table.id).in('status', OPEN_STATUSES);
      const taken = (groups || []).reduce((n: number, g: any) => n + (Number(g.covers) || 0), 0);
      if (capacity > 0 && taken + covers > capacity) {
        await releaseRef();
        return { success: false, error: await te('errors.notEnoughSeats', { free: Math.max(0, capacity - taken) }) };
      }
    }

    let orderId: string;
    if (open) {
      orderId = open.id as string;
      const patch: Record<string, unknown> = {};
      if (covers && !open.covers) patch.covers = covers;
      // De nouveaux plats partent tout de suite : la commande repart en préparation
      const fired = lines.filter((l) => !l.held);
      if (fired.length) {
        if (open.status === 'READY' || open.status === 'SERVED') patch.status = 'IN_PROGRESS';
        if (fired.some((l) => productById.get(l.productId).destination !== 'BAR')) patch.kitchen_status = null;
        if (fired.some((l) => productById.get(l.productId).destination === 'BAR')) patch.bar_status = null;
      }
      if (Object.keys(patch).length) await admin.from('orders').update(patch).eq('id', orderId).eq('structure_id', session.structureId);
    } else {
      const tableNumber = Number.parseInt(String(table.name).replace(/\D/g, ''), 10);
      const { data: order, error } = await admin
        .from('orders')
        .insert({
          structure_id: session.structureId,
          user_id: session.userId,
          table_id: table.id,
          table_number: Number.isFinite(tableNumber) ? tableNumber : null,
          covers,
          status: 'PENDING',
          consumption_type: 'DINE_IN',
          subtotal: 0,
          total: 0,
        })
        .select('id')
        .single();
      if (error || !order) throw error ?? new Error('order insert');
      orderId = order.id as string;
      createdOrderId = orderId;
    }

    const now = new Date().toISOString();
    const { data: inserted, error: itemsError } = await admin
      .from('order_items')
      .insert(
        lines.map((l) => {
          const price = Number(productById.get(l.productId).price) || 0;
          return {
            order_id: orderId,
            product_id: l.productId,
            quantity: l.quantity,
            unit_price: price,
            total_price: price * l.quantity,
            notes: l.note || null,
            held: l.held,
            fired_at: l.held ? null : now,
            is_price_counted: true,
            parent_order_item_id: null,
          };
        }),
      )
      .select('id');
    if (itemsError || !inserted || inserted.length !== lines.length) throw itemsError ?? new Error('items insert');

    const accRows = lines.flatMap((l, index) =>
      l.accompaniments.map((accId) => {
        const quantity = (accMultiplier.get(`${l.productId}:${accId}`) ?? 1) * l.quantity;
        const unit = accPrice.get(accId) ?? 0;
        return {
          order_id: orderId,
          parent_order_item_id: inserted[index].id,
          accompaniment_id: accId,
          quantity,
          unit_price_snapshot: unit,
          total_price_snapshot: unit * quantity,
          is_price_counted: true,
        };
      }),
    );
    if (accRows.length) {
      const { error } = await admin.from('order_accompaniments').insert(accRows);
      if (error) throw error;
    }

    await recomputeOrderTotal(orderId);
    await admin.from('order_submissions').update({ order_id: orderId }).eq('ref', input.ref);

    if (createdOrderId) {
      await notifyCashiers(orderId, session.structureId, 'waiterOrder');
    }
    return { success: true, orderId };
  } catch (error) {
    console.error('[waiter] submitWaiterOrder:', error);
    if (createdOrderId) await admin.from('orders').delete().eq('id', createdOrderId).eq('structure_id', session.structureId);
    await releaseRef(); // le téléphone pourra renvoyer le même `ref`
    return { success: false, error: await te('errors.orderCreateFailed') };
  }
}

// ── Envoi en deux temps ──────────────────────────────────

/** Envoie en cuisine et au bar les lignes encore en attente d'une commande. */
export async function fireHeldItems(orderId: string): Promise<{ success: boolean; error?: string; fired?: number }> {
  const session = await requireWaiter();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data: order } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('structure_id', session.structureId)
    .in('status', OPEN_STATUSES)
    .maybeSingle();
  if (!order) return { success: false, error: await te('errors.orderNotFound') };

  const { data: fired, error } = await admin
    .from('order_items')
    .update({ held: false, fired_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('held', true)
    .select('products(destination)');
  if (error) return { success: false, error: await te('errors.statusUpdateFailed') };
  if (!fired?.length) return { success: true, fired: 0 };

  const patch: Record<string, unknown> = {};
  if (fired.some((i: any) => i.products?.destination !== 'BAR')) patch.kitchen_status = null;
  if (fired.some((i: any) => i.products?.destination === 'BAR')) patch.bar_status = null;
  if (order.status === 'READY' || order.status === 'SERVED') patch.status = 'IN_PROGRESS';
  await admin.from('orders').update(patch).eq('id', orderId).eq('structure_id', session.structureId);
  return { success: true, fired: fired.length };
}

// ── Suivi ────────────────────────────────────────────────

export type WaiterOrder = {
  id: string;
  tableId: string | null;
  tableName: string;
  covers: number | null;
  status: string;
  kitchenStatus: string | null;
  barStatus: string | null;
  total: number;
  createdAt: string;
  lines: { name: string; quantity: number; note: string | null; held: boolean; station: 'CUISINE' | 'BAR' }[];
};

/** Commandes ouvertes que le serveur a prises (les plus récentes d'abord). */
export async function getWaiterOrders(): Promise<WaiterOrder[] | null> {
  const session = await requireWaiter();
  if (!session) return null;
  const { data } = await getAdminSupabase()
    .from('orders')
    .select('id, table_id, covers, status, kitchen_status, bar_status, total, created_at, tables(name), order_items(quantity, notes, held, parent_order_item_id, products(name, destination))')
    .eq('structure_id', session.structureId)
    .eq('user_id', session.userId)
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data || []).map((o: any) => ({
    id: o.id,
    tableId: o.table_id,
    tableName: o.tables?.name ?? '—',
    covers: o.covers ?? null,
    status: o.status,
    kitchenStatus: o.kitchen_status ?? null,
    barStatus: o.bar_status ?? null,
    total: Number(o.total) || 0,
    createdAt: o.created_at,
    lines: (o.order_items || [])
      .filter((i: any) => !i.parent_order_item_id)
      .map((i: any) => ({
        name: i.products?.name ?? '—',
        quantity: Number(i.quantity) || 0,
        note: i.notes ?? null,
        held: Boolean(i.held),
        station: i.products?.destination === 'BAR' ? 'BAR' : 'CUISINE',
      })),
  }));
}

/** Le serveur a servi la table : commande prête → servie. */
export async function markOrderServed(orderId: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireWaiter();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { data } = await getAdminSupabase()
    .from('orders')
    .update({ status: 'SERVED' })
    .eq('id', orderId)
    .eq('structure_id', session.structureId)
    .eq('status', 'READY')
    .select('id')
    .maybeSingle();
  if (!data) return { success: false, error: await te('errors.orderNotFound') };
  await notifyCashiers(orderId, session.structureId, 'orderServed');
  return { success: true };
}

/** Prévient la caisse (caissiers et responsables du point) qu'une commande de serveur attend son paiement. */
async function notifyCashiers(orderId: string, structureId: string, kind: 'waiterOrder' | 'orderServed') {
  const { data: order } = await getAdminSupabase()
    .from('orders')
    .select('total, table_number, tables(name, floor_name), users!user_id(first_name, last_name)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return;
  const tbl = order.tables as { name?: string; floor_name?: string | null } | null;
  const table = tbl?.name ? [tbl.name, tbl.floor_name].filter(Boolean).join(' · ') : String(order.table_number ?? '—');
  const waiter = fullName(order.users as { first_name?: string | null; last_name?: string | null } | null) || '—';
  await notifyStructureStaff({
    structureId,
    message: ({ t, format }) => ({
      title: t(`notify.${kind}.title`),
      body: t(`notify.${kind}.body`, { table, waiter, amount: format.money(Number(order.total) || 0) }),
    }),
    url: `/orders/${orderId}`,
    roles: ['ADMIN', 'CAISSE'],
  });
}
