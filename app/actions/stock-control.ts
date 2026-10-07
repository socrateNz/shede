'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { LOSS_REASONS, recordLoss, type LossReason, type StockItemType } from '@/lib/stock';

// Pertes déclarées et rapport d'écarts de stock (docs/phase17-inventory.sql), module STOCK.

type Result = { success: boolean; error: string };

const DECLARE_ROLES = ['ADMIN', 'MANAGER', 'MAGASINIER', 'SUPER_ADMIN'];
const REPORT_ROLES = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'];

async function requireStock(roles: string[]) {
  const session = await getSession();
  if (!session?.structureId || !roles.includes(session.role)) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.modules?.includes('STOCK')) return null;
  return session as typeof session & { structureId: string };
}

const fullName = (u: any) => (u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || null : null);
const itemTypeOf = (m: any): StockItemType => (m.ingredient_id ? 'ingredient' : m.accompaniment_id ? 'accompaniment' : 'product');
const itemIdOf = (m: any): string => m.ingredient_id ?? m.accompaniment_id ?? m.product_id;

// ── Pertes ───────────────────────────────────────────────

export async function declareLoss(input: {
  itemType: StockItemType;
  itemId: string;
  quantity: number;
  reason: LossReason;
  note?: string;
}): Promise<Result & { value?: number }> {
  const session = await requireStock(DECLARE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return { success: false, error: await te('stockControl.losses.errors.quantityInvalid') };
  if (!LOSS_REASONS.includes(input.reason)) return { success: false, error: await te('stockControl.losses.errors.reasonInvalid') };

  // L'article doit appartenir au point.
  const table = input.itemType === 'ingredient' ? 'ingredients' : input.itemType === 'accompaniment' ? 'accompaniments' : 'products';
  const { data: item } = await getAdminSupabase().from(table).select('id').eq('id', input.itemId).eq('structure_id', session.structureId).maybeSingle();
  if (!item) return { success: false, error: await te('stockControl.losses.errors.itemInvalid') };

  try {
    const value = await recordLoss({
      structureId: session.structureId,
      userId: session.userId,
      itemId: input.itemId,
      itemType: input.itemType,
      quantity: input.quantity,
      reason: input.reason,
      note: String(input.note ?? '').trim().slice(0, 300) || null,
    });
    revalidatePath('/stock');
    revalidatePath('/stock/losses');
    revalidatePath('/stock/variances');
    return { success: true, error: '', value };
  } catch (error) {
    console.error('[stock] perte :', error);
    return { success: false, error: await te('errors.createFailed') };
  }
}

export type LossRow = {
  id: string;
  created_at: string;
  item_type: StockItemType;
  name: string;
  unit: string | null;
  quantity: number;
  value: number | null;
  reason: LossReason | null;
  note: string | null;
  user: string | null;
};

/** Pertes déclarées sur une période. null : migration phase 17 non exécutée. */
export async function listLosses(from: string, to: string): Promise<LossRow[] | null> {
  const session = await requireStock(DECLARE_ROLES);
  if (!session) return [];
  const { data, error } = await getAdminSupabase()
    .from('stock_movements')
    .select('id, created_at, product_id, accompaniment_id, ingredient_id, quantity, unit_cost, loss_reason, note, products(name), accompaniments(name), ingredients(name, unit), users(first_name, last_name)')
    .eq('structure_id', session.structureId)
    .eq('reason', 'loss')
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return error.code === '42703' || error.code === 'PGRST200' || error.code === 'PGRST204' ? null : [];
  return (data || []).map((m: any) => ({
    id: m.id,
    created_at: m.created_at,
    item_type: itemTypeOf(m),
    name: m.ingredients?.name ?? m.products?.name ?? m.accompaniments?.name ?? '—',
    unit: m.ingredients?.unit ?? null,
    quantity: Number(m.quantity) || 0,
    value: m.unit_cost === null ? null : Math.round((Number(m.quantity) || 0) * Number(m.unit_cost)),
    reason: m.loss_reason,
    note: m.note,
    user: fullName(m.users),
  }));
}

// ── Écarts : théorique (ventes) / pertes / inventaires ───

export type VarianceRow = {
  key: string;
  item_type: StockItemType;
  name: string;
  unit: string | null;
  /** Consommation théorique (ventes) */
  sold: number;
  soldValue: number | null;
  /** Pertes déclarées */
  lost: number;
  lostValue: number | null;
  /** Écart d'inventaire inexpliqué : compté − attendu (négatif = manquant) */
  inventoryGap: number;
  inventoryGapValue: number | null;
};

export type VarianceReport = {
  rows: VarianceRow[];
  totals: { soldValue: number; lostValue: number; inventoryGapValue: number };
  inventories: number;
};

/** Rapport d'écarts sur une période. null : migration phase 17 non exécutée. */
export async function getVarianceReport(from: string, to: string): Promise<VarianceReport | null> {
  const session = await requireStock(REPORT_ROLES);
  if (!session) return { rows: [], totals: { soldValue: 0, lostValue: 0, inventoryGapValue: 0 }, inventories: 0 };
  const admin = getAdminSupabase();

  const [{ data: movements, error }, { data: inventories }] = await Promise.all([
    admin
      .from('stock_movements')
      .select('product_id, accompaniment_id, ingredient_id, reason, quantity, unit_cost, products(name), accompaniments(name), ingredients(name, unit)')
      .eq('structure_id', session.structureId)
      .eq('type', 'OUT')
      .in('reason', ['sale', 'loss'])
      .gte('created_at', from)
      .lt('created_at', to)
      .limit(20000),
    admin
      .from('inventories')
      .select('id, inventory_lines(item_type, product_id, accompaniment_id, ingredient_id, counted_quantity, expected_quantity, unit_cost, products(name), accompaniments(name), ingredients(name, unit))')
      .eq('structure_id', session.structureId)
      .eq('status', 'VALIDATED')
      .gte('validated_at', from)
      .lt('validated_at', to),
  ]);
  if (error) return error.code === '42703' || error.code === 'PGRST200' ? null : { rows: [], totals: { soldValue: 0, lostValue: 0, inventoryGapValue: 0 }, inventories: 0 };

  const rows = new Map<string, VarianceRow>();
  const rowFor = (m: any): VarianceRow => {
    const itemType = itemTypeOf(m);
    const key = `${itemType}:${itemIdOf(m)}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        item_type: itemType,
        name: m.ingredients?.name ?? m.products?.name ?? m.accompaniments?.name ?? '—',
        unit: m.ingredients?.unit ?? null,
        sold: 0,
        soldValue: null,
        lost: 0,
        lostValue: null,
        inventoryGap: 0,
        inventoryGapValue: null,
      };
      rows.set(key, row);
    }
    return row;
  };
  const add = (current: number | null, quantity: number, cost: unknown) =>
    cost === null || cost === undefined ? current : (current ?? 0) + quantity * Number(cost);

  for (const m of movements || []) {
    const row = rowFor(m);
    const quantity = Number(m.quantity) || 0;
    if (m.reason === 'sale') {
      row.sold += quantity;
      row.soldValue = add(row.soldValue, quantity, m.unit_cost);
    } else {
      row.lost += quantity;
      row.lostValue = add(row.lostValue, quantity, m.unit_cost);
    }
  }
  for (const inventory of inventories || []) {
    for (const line of (inventory as any).inventory_lines || []) {
      if (line.counted_quantity === null || line.expected_quantity === null) continue;
      const row = rowFor(line);
      const gap = Number(line.counted_quantity) - Number(line.expected_quantity);
      row.inventoryGap += gap;
      row.inventoryGapValue = add(row.inventoryGapValue, gap, line.unit_cost);
    }
  }

  const list = [...rows.values()].map((r) => ({
    ...r,
    sold: Math.round(r.sold * 1000) / 1000,
    lost: Math.round(r.lost * 1000) / 1000,
    inventoryGap: Math.round(r.inventoryGap * 1000) / 1000,
    soldValue: r.soldValue === null ? null : Math.round(r.soldValue),
    lostValue: r.lostValue === null ? null : Math.round(r.lostValue),
    inventoryGapValue: r.inventoryGapValue === null ? null : Math.round(r.inventoryGapValue),
  }));
  // Les plus gros écarts en valeur d'abord (manquants), puis les pertes
  list.sort((a, b) => (a.inventoryGapValue ?? 0) - (b.inventoryGapValue ?? 0) || (b.lostValue ?? 0) - (a.lostValue ?? 0));

  return {
    rows: list,
    totals: {
      soldValue: list.reduce((s, r) => s + (r.soldValue ?? 0), 0),
      lostValue: list.reduce((s, r) => s + (r.lostValue ?? 0), 0),
      inventoryGapValue: list.reduce((s, r) => s + (r.inventoryGapValue ?? 0), 0),
    },
    inventories: (inventories || []).length,
  };
}
