'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { getT, te } from '@/lib/i18n/server';
import { sendMail } from '@/lib/mail';
import { getStructureTaxSettings } from '@/lib/fiscal';
import { accountingDate, postExpense } from '@/lib/accounting/posting';
import { EXPENSE_CATEGORIES } from '@/lib/accounting/mapping';
import { buildMeta, emptyPage, pageRange, searchTerm, settlePage, type Paginated } from '@/lib/pagination';

// Achats (docs/phase18-purchasing.sql), module ACHATS : fournisseurs et leur
// catalogue, bons de commande, réceptions (entrée en stock et coût moyen pondéré,
// fonction SQL receive_goods) et, si la comptabilité est active, facture
// fournisseur en dépense à régler.

type Result<T = undefined> = { success: true; error: ''; data?: T } | { success: false; error: string };

const MANAGE_ROLES = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'];
const RECEIVE_ROLES = ['ADMIN', 'MANAGER', 'MAGASINIER', 'SUPER_ADMIN'];

async function requirePurchasing(roles: string[]) {
  const session = await getSession();
  if (!session?.structureId || !roles.includes(session.role)) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.modules?.includes('ACHATS')) return null;
  return session as typeof session & { structureId: string };
}

const notInstalled = (error: { code?: string } | null) =>
  error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === '42703' || error?.code === 'PGRST200';

function revalidatePurchasing() {
  revalidatePath('/purchasing', 'layout');
  revalidatePath('/stock');
  revalidatePath('/stock/ingredients');
}

// ── Fournisseurs ─────────────────────────────────────────

export type PurchasingSupplier = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  niu: string | null;
  address: string | null;
  delivery_days: number[];
  lead_time_days: number;
  min_order_amount: number;
  charges_vat: boolean;
  is_active: boolean;
  item_count: number;
};

/** Fournisseurs du point. null : migration phase 18 non exécutée. */
/** Ligne de la base → fournisseur affichable. */
function toPurchasingSupplier(s: any): PurchasingSupplier {
  return {
    id: s.id,
    name: s.name,
    contact_name: s.contact_name,
    phone: s.phone,
    email: s.email,
    niu: s.niu,
    address: s.address,
    delivery_days: (s.delivery_days || []).map(Number),
    lead_time_days: Number(s.lead_time_days) || 0,
    min_order_amount: Number(s.min_order_amount) || 0,
    charges_vat: s.charges_vat !== false,
    is_active: s.is_active !== false,
    item_count: (s.supplier_items || []).filter((i: any) => i.is_active).length,
  };
}

export type SupplierListStats = { total: number; active: number };

/** Fournisseurs du point pour la page de gestion : 20 par page (ordre alphabétique), recherche nom/contact. null : module non installé. */
export async function listSuppliersPage(filters: { page?: number; q?: string } = {}): Promise<Paginated<PurchasingSupplier, SupplierListStats> | null> {
  const empty: SupplierListStats = { total: 0, active: 0 };
  const page = Math.max(1, filters.page ?? 1);
  const session = await requirePurchasing(RECEIVE_ROLES);
  if (!session) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const q = searchTerm(filters.q);
  let query = admin
    .from('suppliers')
    .select('id, name, contact_name, phone, email, niu, address, delivery_days, lead_time_days, min_order_amount, charges_vat, is_active, supplier_items(id, is_active)', { count: 'exact' })
    .eq('structure_id', session.structureId)
    .order('name')
    .order('id')
    .range(from, to);
  if (q) query = query.or(`name.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%`);
  const head = () => admin.from('suppliers').select('id', { count: 'exact', head: true }).eq('structure_id', session.structureId);
  const [{ data, count, error }, total, active] = await Promise.all([settlePage(query), head(), head().eq('is_active', true)]);
  if (error) return notInstalled(error) ? null : emptyPage(empty, page);
  return { items: (data || []).map(toPurchasingSupplier), meta: buildMeta(page, count ?? 0, { total: total.count ?? 0, active: active.count ?? 0 }) };
}

export async function listPurchasingSuppliers(includeInactive = true): Promise<PurchasingSupplier[] | null> {
  const session = await requirePurchasing(RECEIVE_ROLES);
  if (!session) return [];
  let query = getAdminSupabase()
    .from('suppliers')
    .select('id, name, contact_name, phone, email, niu, address, delivery_days, lead_time_days, min_order_amount, charges_vat, is_active, supplier_items(id, is_active)')
    .eq('structure_id', session.structureId)
    .order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) return notInstalled(error) ? null : [];
  return (data || []).map(toPurchasingSupplier);
}

export async function saveSupplier(input: {
  id?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  niu?: string;
  address?: string;
  deliveryDays: number[];
  leadTimeDays: number;
  minOrderAmount: number;
  chargesVat: boolean;
}): Promise<Result<{ id: string }>> {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const name = String(input.name ?? '').trim();
  if (!name) return { success: false, error: await te('purchasing.errors.supplierNameRequired') };
  const lead = Math.round(Number(input.leadTimeDays));
  const minimum = Number(input.minOrderAmount);
  if (!Number.isFinite(lead) || lead < 0 || lead > 60 || !Number.isFinite(minimum) || minimum < 0) {
    return { success: false, error: await te('purchasing.errors.amountInvalid') };
  }
  const payload = {
    name: name.slice(0, 150),
    contact_name: input.contactName?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    niu: input.niu?.trim().toUpperCase() || null,
    address: input.address?.trim() || null,
    delivery_days: [...new Set((input.deliveryDays || []).map(Number).filter((d) => d >= 1 && d <= 7))].sort(),
    lead_time_days: lead,
    min_order_amount: Math.round(minimum),
    charges_vat: Boolean(input.chargesVat),
  };
  const admin = getAdminSupabase();
  const { data, error } = input.id
    ? await admin.from('suppliers').update(payload).eq('id', input.id).eq('structure_id', session.structureId).select('id').single()
    : await admin.from('suppliers').insert({ ...payload, structure_id: session.structureId }).select('id').single();
  if (error || !data) return { success: false, error: await te('errors.updateFailed') };
  revalidatePurchasing();
  revalidatePath('/accounting/suppliers');
  return { success: true, error: '', data: { id: data.id } };
}

export async function setSupplierActive(id: string, isActive: boolean): Promise<Result> {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { error } = await getAdminSupabase().from('suppliers').update({ is_active: isActive }).eq('id', id).eq('structure_id', session.structureId);
  if (error) return { success: false, error: await te('errors.updateFailed') };
  revalidatePurchasing();
  return { success: true, error: '' };
}

// ── Catalogue fournisseur ────────────────────────────────

export type CatalogItem = {
  id: string;
  item_type: 'ingredient' | 'product';
  item_id: string;
  name: string;
  /** Unité de stock : kg, l, piece (ingrédients) ; null = unité (produits). */
  unit: string | null;
  reference: string | null;
  pack_label: string;
  pack_size: number;
  unit_price: number;
  is_preferred: boolean;
  is_active: boolean;
  stock: number;
  threshold: number;
};

export type CatalogOption = { id: string; item_type: 'ingredient' | 'product'; name: string; unit: string | null };

async function loadCatalog(structureId: string, supplierId: string): Promise<CatalogItem[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('supplier_items')
    .select('id, ingredient_id, product_id, reference, pack_label, pack_size, unit_price, is_preferred, is_active, ingredients(name, unit), products(name)')
    .eq('structure_id', structureId)
    .eq('supplier_id', supplierId);
  const items = (data || []) as any[];
  const { data: stocks } = await admin
    .from('stocks')
    .select('ingredient_id, product_id, quantity, threshold')
    .eq('structure_id', structureId);
  const stockOf = new Map<string, { quantity: number; threshold: number }>();
  for (const s of stocks || []) {
    const key = (s.ingredient_id ?? s.product_id) as string | null;
    if (key) stockOf.set(key, { quantity: Number(s.quantity) || 0, threshold: Number(s.threshold) || 0 });
  }
  return items
    .map((i) => {
      const itemId = (i.ingredient_id ?? i.product_id) as string;
      return {
        id: i.id,
        item_type: i.ingredient_id ? ('ingredient' as const) : ('product' as const),
        item_id: itemId,
        name: i.ingredients?.name ?? i.products?.name ?? '—',
        unit: i.ingredients?.unit ?? null,
        reference: i.reference,
        pack_label: i.pack_label,
        pack_size: Number(i.pack_size),
        unit_price: Number(i.unit_price),
        is_preferred: Boolean(i.is_preferred),
        is_active: i.is_active !== false,
        stock: stockOf.get(itemId)?.quantity ?? 0,
        threshold: stockOf.get(itemId)?.threshold ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Fournisseur, son catalogue et les articles qu'on peut y ajouter. */
export async function getSupplierCatalog(supplierId: string) {
  const session = await requirePurchasing(RECEIVE_ROLES);
  if (!session) return null;
  const suppliers = await listPurchasingSuppliers();
  const supplier = suppliers?.find((s) => s.id === supplierId);
  if (!supplier) return null;
  const admin = getAdminSupabase();
  const [items, { data: ingredients }, { data: products }] = await Promise.all([
    loadCatalog(session.structureId, supplierId),
    admin.from('ingredients').select('id, name, unit').eq('structure_id', session.structureId).eq('is_active', true).order('name'),
    admin.from('products').select('id, name').eq('structure_id', session.structureId).eq('is_deleted', false).order('name'),
  ]);
  const options: CatalogOption[] = [
    ...(ingredients || []).map((i) => ({ id: i.id as string, item_type: 'ingredient' as const, name: i.name as string, unit: i.unit as string })),
    ...(products || []).map((p) => ({ id: p.id as string, item_type: 'product' as const, name: p.name as string, unit: null })),
  ];
  return { supplier, items, options, canManage: MANAGE_ROLES.includes(session.role) };
}

export async function saveSupplierItem(input: {
  id?: string;
  supplierId: string;
  itemType: 'ingredient' | 'product';
  itemId: string;
  reference?: string;
  packLabel: string;
  packSize: number;
  unitPrice: number;
  isPreferred?: boolean;
}): Promise<Result> {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const packLabel = String(input.packLabel ?? '').trim().slice(0, 60);
  const packSize = Number(input.packSize);
  const price = Number(input.unitPrice);
  if (!packLabel || !Number.isFinite(packSize) || packSize <= 0 || !Number.isFinite(price) || price < 0) {
    return { success: false, error: await te('purchasing.errors.itemInvalid') };
  }
  const admin = getAdminSupabase();
  const table = input.itemType === 'ingredient' ? 'ingredients' : 'products';
  const [{ data: supplier }, { data: item }] = await Promise.all([
    admin.from('suppliers').select('id').eq('id', input.supplierId).eq('structure_id', session.structureId).maybeSingle(),
    admin.from(table).select('id').eq('id', input.itemId).eq('structure_id', session.structureId).maybeSingle(),
  ]);
  if (!supplier || !item) return { success: false, error: await te('purchasing.errors.itemInvalid') };

  const payload = {
    structure_id: session.structureId,
    supplier_id: input.supplierId,
    ingredient_id: input.itemType === 'ingredient' ? input.itemId : null,
    product_id: input.itemType === 'product' ? input.itemId : null,
    reference: input.reference?.trim().slice(0, 60) || null,
    pack_label: packLabel,
    pack_size: Math.round(packSize * 1000) / 1000,
    unit_price: Math.round(price),
    is_preferred: Boolean(input.isPreferred),
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await admin.from('supplier_items').update(payload).eq('id', input.id).eq('structure_id', session.structureId)
    : await admin.from('supplier_items').insert(payload);
  if (error) return { success: false, error: await te(error.code === '23505' ? 'purchasing.errors.itemDuplicate' : 'errors.updateFailed') };
  revalidatePurchasing();
  return { success: true, error: '' };
}

/**
 * Ajoute plusieurs articles au catalogue d'un fournisseur en une fois. Tout ou
 * rien : une ligne invalide ou déjà au catalogue bloque l'enregistrement.
 */
export async function addSupplierItems(
  supplierId: string,
  items: {
    itemType: 'ingredient' | 'product';
    itemId: string;
    reference?: string;
    packLabel: string;
    packSize: number;
    unitPrice: number;
    isPreferred?: boolean;
  }[]
): Promise<Result<{ count: number }>> {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (!items.length) return { success: false, error: await te('purchasing.errors.itemInvalid') };

  const keys = items.map((i) => `${i.itemType}:${i.itemId}`);
  if (new Set(keys).size !== keys.length) return { success: false, error: await te('purchasing.errors.itemRepeated') };
  for (const i of items) {
    const packSize = Number(i.packSize);
    const price = Number(i.unitPrice);
    if (!i.itemId || !String(i.packLabel ?? '').trim() || !Number.isFinite(packSize) || packSize <= 0 || !Number.isFinite(price) || price < 0) {
      return { success: false, error: await te('purchasing.errors.itemInvalid') };
    }
  }

  const admin = getAdminSupabase();
  const ingredientIds = items.filter((i) => i.itemType === 'ingredient').map((i) => i.itemId);
  const productIds = items.filter((i) => i.itemType === 'product').map((i) => i.itemId);
  const [{ data: supplier }, { data: ingredients }, { data: products }] = await Promise.all([
    admin.from('suppliers').select('id').eq('id', supplierId).eq('structure_id', session.structureId).maybeSingle(),
    ingredientIds.length
      ? admin.from('ingredients').select('id').eq('structure_id', session.structureId).in('id', ingredientIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    productIds.length
      ? admin.from('products').select('id').eq('structure_id', session.structureId).in('id', productIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  if (!supplier || (ingredients || []).length !== ingredientIds.length || (products || []).length !== productIds.length) {
    return { success: false, error: await te('purchasing.errors.itemInvalid') };
  }

  const now = new Date().toISOString();
  const { error } = await admin.from('supplier_items').insert(
    items.map((i) => ({
      structure_id: session.structureId,
      supplier_id: supplierId,
      ingredient_id: i.itemType === 'ingredient' ? i.itemId : null,
      product_id: i.itemType === 'product' ? i.itemId : null,
      reference: i.reference?.trim().slice(0, 60) || null,
      pack_label: String(i.packLabel).trim().slice(0, 60),
      pack_size: Math.round(Number(i.packSize) * 1000) / 1000,
      unit_price: Math.round(Number(i.unitPrice)),
      is_preferred: Boolean(i.isPreferred),
      is_active: true,
      updated_at: now,
    }))
  );
  if (error) return { success: false, error: await te(error.code === '23505' ? 'purchasing.errors.itemDuplicate' : 'errors.createFailed') };
  revalidatePurchasing();
  return { success: true, error: '', data: { count: items.length } };
}

export async function deleteSupplierItem(id: string): Promise<Result> {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  // Les lignes de commande gardent leur copie (libellé, prix) : suppression sans risque.
  const { error } = await getAdminSupabase().from('supplier_items').delete().eq('id', id).eq('structure_id', session.structureId);
  if (error) return { success: false, error: await te('errors.deleteFailed') };
  revalidatePurchasing();
  return { success: true, error: '' };
}

// ── Bons de commande ─────────────────────────────────────

export type OrderStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

export type PurchaseOrderSummary = {
  id: string;
  number: string;
  status: OrderStatus;
  supplier_id: string;
  supplier_name: string;
  expected_date: string | null;
  total_ht: number;
  created_at: string;
  line_count: number;
};

export type PurchaseOrderStat = { count: number; amount: number };
export type PurchaseOrderListStats = { total: PurchaseOrderStat; byStatus: Record<string, PurchaseOrderStat> };
const PURCHASE_ORDER_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED'];

/**
 * Bons de commande du point, 20 par page (les plus récents d'abord), filtre par statut et
 * recherche par numéro ; statistiques par statut en SQL. null : module non installé.
 */
export async function listPurchaseOrders(
  filters: { page?: number; q?: string; status?: string | null } = {},
): Promise<Paginated<PurchaseOrderSummary, PurchaseOrderListStats> | null> {
  const empty: PurchaseOrderListStats = { total: { count: 0, amount: 0 }, byStatus: {} };
  const page = Math.max(1, filters.page ?? 1);
  const session = await requirePurchasing(RECEIVE_ROLES);
  if (!session) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const q = searchTerm(filters.q);

  let query = admin
    .from('purchase_orders')
    .select('id, number, status, supplier_id, expected_date, total_ht, created_at, suppliers(name), purchase_order_lines(id)', { count: 'exact' })
    .eq('structure_id', session.structureId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (filters.status && PURCHASE_ORDER_STATUSES.includes(filters.status)) query = query.eq('status', filters.status);
  if (q) query = query.ilike('number', `%${q}%`);

  const [{ data, count, error }, statsRes] = await Promise.all([settlePage(query), admin.rpc('purchase_order_list_stats', { p_structure_id: session.structureId })]);
  if (error) return notInstalled(error) ? null : emptyPage(empty, page);
  const raw = (statsRes.data ?? empty) as PurchaseOrderListStats;
  const stats: PurchaseOrderListStats = {
    total: { count: Number(raw.total?.count) || 0, amount: Number(raw.total?.amount) || 0 },
    byStatus: Object.fromEntries(Object.entries(raw.byStatus ?? {}).map(([k, v]) => [k, { count: Number(v.count) || 0, amount: Number(v.amount) || 0 }])),
  };
  const items = (data || []).map((o: any) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    supplier_id: o.supplier_id,
    supplier_name: o.suppliers?.name ?? '—',
    expected_date: o.expected_date,
    total_ht: Number(o.total_ht) || 0,
    created_at: o.created_at,
    line_count: (o.purchase_order_lines || []).length,
  }));
  return { items, meta: buildMeta(page, count ?? 0, stats) };
}

export type PurchaseOrderLine = {
  id: string;
  supplier_item_id: string | null;
  item_type: 'ingredient' | 'product' | null;
  item_id: string | null;
  label: string;
  unit: string | null;
  pack_label: string;
  pack_size: number;
  quantity: number;
  unit_price: number;
  received_quantity: number;
};

export type PurchaseOrderDetail = PurchaseOrderSummary & {
  note: string | null;
  sent_at: string | null;
  supplier: PurchasingSupplier | null;
  lines: PurchaseOrderLine[];
  receipts: { id: string; number: string; received_at: string; total_ht: number }[];
  canManage: boolean;
};

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderDetail | null> {
  const session = await requirePurchasing(RECEIVE_ROLES);
  if (!session) return null;
  const admin = getAdminSupabase();
  const { data: order } = await admin
    .from('purchase_orders')
    .select('*, suppliers(name), purchase_order_lines(*, ingredients(unit)), goods_receipts(id, number, received_at, total_ht)')
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!order) return null;
  const suppliers = await listPurchasingSuppliers();
  const o = order as any;
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    supplier_id: o.supplier_id,
    supplier_name: o.suppliers?.name ?? '—',
    expected_date: o.expected_date,
    total_ht: Number(o.total_ht) || 0,
    created_at: o.created_at,
    line_count: (o.purchase_order_lines || []).length,
    note: o.note,
    sent_at: o.sent_at,
    supplier: suppliers?.find((s) => s.id === o.supplier_id) ?? null,
    lines: (o.purchase_order_lines || []).map((l: any) => ({
      id: l.id,
      supplier_item_id: l.supplier_item_id,
      item_type: l.ingredient_id ? 'ingredient' : l.product_id ? 'product' : null,
      item_id: l.ingredient_id ?? l.product_id ?? null,
      label: l.label,
      unit: l.ingredients?.unit ?? null,
      pack_label: l.pack_label,
      pack_size: Number(l.pack_size),
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      received_quantity: Number(l.received_quantity) || 0,
    })),
    receipts: (o.goods_receipts || [])
      .map((r: any) => ({ id: r.id, number: r.number, received_at: r.received_at, total_ht: Number(r.total_ht) || 0 }))
      .sort((a: any, b: any) => b.received_at.localeCompare(a.received_at)),
    canManage: MANAGE_ROLES.includes(session.role),
  };
}

/** Données du formulaire de commande : fournisseurs actifs et leur catalogue. */
export async function getOrderFormData() {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return null;
  const suppliers = (await listPurchasingSuppliers(false)) ?? [];
  const catalogs = Object.fromEntries(
    await Promise.all(suppliers.map(async (s) => [s.id, (await loadCatalog(session.structureId, s.id)).filter((i) => i.is_active)] as const))
  );
  return { suppliers, catalogs };
}

/** Crée ou modifie (brouillon) un bon de commande. Prix et conditionnements copiés du catalogue. */
export async function savePurchaseOrder(input: {
  id?: string;
  supplierId: string;
  expectedDate?: string | null;
  note?: string;
  lines: { supplierItemId: string; quantity: number }[];
}): Promise<Result<{ id: string }>> {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();

  const wanted = input.lines.filter((l) => Number(l.quantity) > 0);
  if (!wanted.length) return { success: false, error: await te('purchasing.errors.orderEmpty') };
  if (input.expectedDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.expectedDate)) {
    return { success: false, error: await te('purchasing.errors.dateInvalid') };
  }

  const { data: items } = await admin
    .from('supplier_items')
    .select('id, ingredient_id, product_id, pack_label, pack_size, unit_price, ingredients(name), products(name)')
    .eq('structure_id', session.structureId)
    .eq('supplier_id', input.supplierId)
    .in('id', wanted.map((l) => l.supplierItemId));
  const byId = new Map((items || []).map((i: any) => [i.id as string, i]));
  if (byId.size !== new Set(wanted.map((l) => l.supplierItemId)).size) {
    return { success: false, error: await te('purchasing.errors.itemInvalid') };
  }

  const lines = wanted.map((l) => {
    const item = byId.get(l.supplierItemId);
    return {
      supplier_item_id: item.id,
      ingredient_id: item.ingredient_id,
      product_id: item.product_id,
      label: (item.ingredients?.name ?? item.products?.name ?? '—').slice(0, 150),
      pack_label: item.pack_label,
      pack_size: Number(item.pack_size),
      quantity: Math.round(Number(l.quantity) * 1000) / 1000,
      unit_price: Number(item.unit_price),
    };
  });
  const total = Math.round(lines.reduce((s, l) => s + l.quantity * l.unit_price, 0));
  const header = {
    supplier_id: input.supplierId,
    expected_date: input.expectedDate || null,
    note: input.note?.trim().slice(0, 500) || null,
    total_ht: total,
    updated_at: new Date().toISOString(),
  };

  let orderId = input.id;
  if (orderId) {
    const { data: updated } = await admin
      .from('purchase_orders')
      .update(header)
      .eq('id', orderId)
      .eq('structure_id', session.structureId)
      .eq('status', 'DRAFT')
      .select('id');
    if (!updated?.length) return { success: false, error: await te('purchasing.errors.orderNotEditable') };
    await admin.from('purchase_order_lines').delete().eq('purchase_order_id', orderId);
  } else {
    const { data: number, error: numberError } = await admin.rpc('next_purchase_number', { p_structure_id: session.structureId, p_kind: 'BC' });
    if (numberError || !number) return { success: false, error: await te('errors.createFailed') };
    const { data: created, error } = await admin
      .from('purchase_orders')
      .insert({ ...header, structure_id: session.structureId, number, created_by: session.userId })
      .select('id')
      .single();
    if (error || !created) return { success: false, error: await te('errors.createFailed') };
    orderId = created.id as string;
  }

  const { error: linesError } = await admin.from('purchase_order_lines').insert(lines.map((l) => ({ ...l, purchase_order_id: orderId })));
  if (linesError) return { success: false, error: await te('errors.updateFailed') };
  revalidatePurchasing();
  return { success: true, error: '', data: { id: orderId! } };
}

/**
 * Envoie le bon de commande au fournisseur par e-mail (s'il en a un) et le marque
 * « envoyé ». channel = 'whatsapp' : marque seulement « envoyé » (le message est
 * ouvert dans WhatsApp par le navigateur).
 */
export async function sendPurchaseOrder(id: string, channel: 'email' | 'whatsapp'): Promise<Result<{ emailed: boolean }>> {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const order = await getPurchaseOrder(id);
  if (!order || !['DRAFT', 'SENT'].includes(order.status)) return { success: false, error: await te('purchasing.errors.orderNotEditable') };

  let emailed = false;
  if (channel === 'email') {
    if (!order.supplier?.email) return { success: false, error: await te('purchasing.errors.noEmail') };
    const { data: point } = await getAdminSupabase().from('structures').select('name, phone, address, city').eq('id', session.structureId).maybeSingle();
    const { t, format } = await getT();
    const result = await sendMail({
      to: order.supplier.email,
      subject: t('purchasing.email.subject', { number: order.number, point: point?.name ?? '' }),
      content: {
        title: t('purchasing.email.title', { number: order.number }),
        paragraphs: [
          t('purchasing.email.intro', { supplier: order.supplier_name, point: point?.name ?? '' }),
          ...(order.expected_date ? [t('purchasing.email.expected', { date: format.date(order.expected_date) })] : []),
          ...(order.note ? [order.note] : []),
          t('purchasing.email.contact', { point: point?.name ?? '', phone: point?.phone ?? '—', address: [point?.address, point?.city].filter(Boolean).join(', ') || '—' }),
        ],
        details: [
          ...order.lines.map((l) => ({
            label: `${l.label} — ${l.pack_label}`,
            value: `${format.number(l.quantity)} × ${format.money(l.unit_price)} = ${format.money(Math.round(l.quantity * l.unit_price))}`,
          })),
          { label: t('purchasing.email.total'), value: format.money(order.total_ht) },
        ],
        footer: t('purchasing.email.footer'),
      },
    });
    if (!result.ok) return { success: false, error: await te('purchasing.errors.emailFailed') };
    emailed = true;
  }

  await getAdminSupabase()
    .from('purchase_orders')
    .update({ status: order.status === 'DRAFT' ? 'SENT' : order.status, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('structure_id', session.structureId);
  revalidatePurchasing();
  return { success: true, error: '', data: { emailed } };
}

export async function cancelPurchaseOrder(id: string): Promise<Result> {
  const session = await requirePurchasing(MANAGE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { data } = await getAdminSupabase()
    .from('purchase_orders')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .in('status', ['DRAFT', 'SENT'])
    .select('id');
  if (!data?.length) return { success: false, error: await te('purchasing.errors.orderNotEditable') };
  revalidatePurchasing();
  return { success: true, error: '' };
}

// ── Réceptions ───────────────────────────────────────────

export type ReceiptLineInput = {
  itemType: 'ingredient' | 'product';
  itemId: string;
  orderLineId?: string | null;
  label: string;
  packLabel: string;
  packSize: number;
  quantity: number;
  unitPrice: number;
};

/**
 * Réceptionne une livraison (avec ou sans bon de commande) : entrée en stock et
 * coût moyen pondéré (atomique), puis facture fournisseur en comptabilité.
 */
export async function receiveGoods(input: {
  supplierId: string;
  orderId?: string | null;
  invoiceReference?: string;
  note?: string;
  lines: ReceiptLineInput[];
}): Promise<Result<{ id: string; number: string; accountingWarning?: string }>> {
  const session = await requirePurchasing(RECEIVE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const lines = input.lines.filter((l) => Number(l.quantity) > 0);
  if (!lines.length) return { success: false, error: await te('purchasing.errors.receiptEmpty') };
  for (const l of lines) {
    if (!(Number(l.packSize) > 0) || !(Number(l.unitPrice) >= 0)) return { success: false, error: await te('purchasing.errors.itemInvalid') };
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc('receive_goods', {
    p_structure_id: session.structureId,
    p_supplier_id: input.supplierId,
    p_order_id: input.orderId || null,
    p_user_id: session.userId,
    p_invoice_reference: input.invoiceReference ?? '',
    p_note: input.note ?? '',
    p_lines: lines.map((l) => ({
      ingredient_id: l.itemType === 'ingredient' ? l.itemId : null,
      product_id: l.itemType === 'product' ? l.itemId : null,
      order_line_id: l.orderLineId || null,
      label: l.label,
      pack_label: l.packLabel,
      pack_size: Number(l.packSize),
      quantity: Math.round(Number(l.quantity) * 1000) / 1000,
      unit_price: Math.round(Number(l.unitPrice)),
    })),
  });
  if (error || !data) {
    const message = error?.message ?? '';
    const key = message.includes('order_closed')
      ? 'purchasing.errors.orderClosed'
      : message.includes('receipt_line_invalid') || message.includes('supplier_invalid') || message.includes('order_invalid')
        ? 'purchasing.errors.itemInvalid'
        : 'errors.createFailed';
    return { success: false, error: await te(key) };
  }
  const receipt = data as { receipt_id: string; number: string; total_ht: number };

  // Facture fournisseur en comptabilité (dépense à régler), si le module est actif
  let accountingWarning: string | undefined;
  if (session.modules?.includes('COMPTABILITE')) {
    try {
      await recordPurchaseExpenses(session.structureId, session.userId, input.supplierId, receipt, lines, input.invoiceReference);
    } catch (postError) {
      console.error('[achats] comptabilisation de la réception :', postError);
      accountingWarning = await te('purchasing.errors.accountingFailed');
    }
  }

  revalidatePurchasing();
  revalidatePath('/accounting', 'layout');
  return { success: true, error: '', data: { id: receipt.receipt_id, number: receipt.number, accountingWarning } };
}

/** Une dépense non payée par nature d'achat : matières premières (602) et marchandises revendues (601). */
async function recordPurchaseExpenses(
  structureId: string,
  userId: string,
  supplierId: string,
  receipt: { receipt_id: string; number: string },
  lines: ReceiptLineInput[],
  invoiceReference?: string
) {
  const admin = getAdminSupabase();
  const [{ data: supplier }, taxSettings] = await Promise.all([
    admin.from('suppliers').select('charges_vat').eq('id', supplierId).maybeSingle(),
    getStructureTaxSettings(structureId),
  ]);
  const vatRate = supplier?.charges_vat === false ? 0 : taxSettings.rate;
  const groups = [
    { category: 'food' as const, amount: lines.filter((l) => l.itemType === 'ingredient').reduce((s, l) => s + l.quantity * l.unitPrice, 0) },
    { category: 'goods' as const, amount: lines.filter((l) => l.itemType === 'product').reduce((s, l) => s + l.quantity * l.unitPrice, 0) },
  ].filter((g) => g.amount > 0);

  const expenseIds: string[] = [];
  for (const group of groups) {
    const ht = Math.round(group.amount);
    const tax = Math.round((ht * vatRate) / 100);
    const { data: expense, error } = await admin
      .from('expenses')
      .insert({
        structure_id: structureId,
        supplier_id: supplierId,
        category: group.category,
        account: EXPENSE_CATEGORIES[group.category].account,
        expense_date: accountingDate(),
        label: `${receipt.number}${invoiceReference ? ` — ${invoiceReference}` : ''}`.slice(0, 250),
        reference: invoiceReference?.trim() || receipt.number,
        amount_ht: ht,
        tax_amount: tax,
        amount_ttc: ht + tax,
        status: 'UNPAID',
        created_by: userId,
      })
      .select('*')
      .single();
    if (error || !expense) throw error ?? new Error('expense insert failed');
    try {
      const entryId = await postExpense(expense, userId);
      await admin.from('expenses').update({ entry_id: entryId }).eq('id', expense.id);
    } catch (postError) {
      await admin.from('expenses').delete().eq('id', expense.id);
      throw postError;
    }
    expenseIds.push(expense.id as string);
  }
  if (expenseIds.length) await admin.from('goods_receipts').update({ expense_ids: expenseIds }).eq('id', receipt.receipt_id);
}

export type ReceiptSummary = {
  id: string;
  number: string;
  supplier_name: string;
  order_number: string | null;
  order_id: string | null;
  invoice_reference: string | null;
  received_at: string;
  received_by: string | null;
  total_ht: number;
  line_count: number;
  accounted: boolean;
};

export type ReceiptListStats = { count: number; amount: number; direct: number; unaccounted: number };

/** Réceptions du point sur une période, 20 par page (les plus récentes d'abord) ; totaux de la période en SQL. null : module non installé. */
export async function listReceipts(periodFrom: string, periodTo: string, filters: { page?: number } = {}): Promise<Paginated<ReceiptSummary, ReceiptListStats> | null> {
  const empty: ReceiptListStats = { count: 0, amount: 0, direct: 0, unaccounted: 0 };
  const page = Math.max(1, filters.page ?? 1);
  const session = await requirePurchasing(RECEIVE_ROLES);
  if (!session) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const [{ data, count, error }, statsRes] = await Promise.all([
    settlePage(admin
      .from('goods_receipts')
      .select('id, number, purchase_order_id, invoice_reference, received_at, total_ht, expense_ids, suppliers(name), purchase_orders(number), users!received_by(first_name, last_name), goods_receipt_lines(id)', { count: 'exact' })
      .eq('structure_id', session.structureId)
      .gte('received_at', periodFrom)
      .lt('received_at', periodTo)
      .order('received_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)),
    admin.rpc('receipt_list_stats', { p_structure_id: session.structureId, p_from: periodFrom, p_to: periodTo }),
  ]);
  if (error) return notInstalled(error) ? null : emptyPage(empty, page);
  const raw = (statsRes.data ?? empty) as ReceiptListStats;
  const stats: ReceiptListStats = { count: Number(raw.count) || 0, amount: Number(raw.amount) || 0, direct: Number(raw.direct) || 0, unaccounted: Number(raw.unaccounted) || 0 };
  const items = (data || []).map((r: any) => ({
    id: r.id,
    number: r.number,
    supplier_name: r.suppliers?.name ?? '—',
    order_number: r.purchase_orders?.number ?? null,
    order_id: r.purchase_order_id,
    invoice_reference: r.invoice_reference,
    received_at: r.received_at,
    received_by: r.users ? [r.users.first_name, r.users.last_name].filter(Boolean).join(' ') : null,
    total_ht: Number(r.total_ht) || 0,
    line_count: (r.goods_receipt_lines || []).length,
    accounted: (r.expense_ids || []).length > 0,
  }));
  return { items, meta: buildMeta(page, count ?? 0, stats) };
}

/** Données du formulaire de réception directe (sans bon de commande). */
export async function getDirectReceiptData() {
  const session = await requirePurchasing(RECEIVE_ROLES);
  if (!session) return null;
  const suppliers = (await listPurchasingSuppliers(false)) ?? [];
  const catalogs = Object.fromEntries(
    await Promise.all(suppliers.map(async (s) => [s.id, (await loadCatalog(session.structureId, s.id)).filter((i) => i.is_active)] as const))
  );
  return { suppliers, catalogs };
}
