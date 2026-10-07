'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';

// Inventaires (docs/phase17-inventory.sql), module STOCK : comptage physique sur
// mobile, puis validation atomique (fonction SQL validate_inventory) qui corrige
// le stock et fige les écarts valorisés.

type Result = { success: boolean; error: string };
export type InventoryItemType = 'ingredient' | 'product' | 'accompaniment';

/** Comptage : magasinier compris. Validation et annulation : responsables. */
const COUNT_ROLES = ['ADMIN', 'MANAGER', 'MAGASINIER', 'SUPER_ADMIN'];
const VALIDATE_ROLES = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'];

async function requireStock(roles: string[]) {
  const session = await getSession();
  if (!session?.structureId || !roles.includes(session.role)) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.modules?.includes('STOCK')) return null;
  return session as typeof session & { structureId: string };
}

const notInstalled = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205';

export type InventorySummary = {
  id: string;
  status: 'DRAFT' | 'VALIDATED' | 'CANCELLED';
  created_at: string;
  validated_at: string | null;
  started_by: string | null;
  validated_by: string | null;
  counted_lines: number;
  total_lines: number;
  variance_value: number | null;
};

const fullName = (u: any) => (u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || null : null);

/** Inventaires du point, du plus récent au plus ancien. null : migration non exécutée. */
export async function listInventories(): Promise<InventorySummary[] | null> {
  const session = await requireStock(COUNT_ROLES);
  if (!session) return [];
  const { data, error } = await getAdminSupabase()
    .from('inventories')
    .select(
      'id, status, created_at, validated_at, variance_value, counted_lines, ' +
        'starter:users!started_by(first_name, last_name), validator:users!validated_by(first_name, last_name), ' +
        'inventory_lines(counted_quantity)'
    )
    .eq('structure_id', session.structureId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return notInstalled(error) ? null : [];
  return (data || []).map((i: any) => {
    const lines = (i.inventory_lines || []) as { counted_quantity: number | null }[];
    return {
      id: i.id,
      status: i.status,
      created_at: i.created_at,
      validated_at: i.validated_at,
      started_by: fullName(i.starter),
      validated_by: fullName(i.validator),
      counted_lines: i.status === 'VALIDATED' ? Number(i.counted_lines) || 0 : lines.filter((l) => l.counted_quantity !== null).length,
      total_lines: lines.length,
      variance_value: i.variance_value === null ? null : Number(i.variance_value),
    };
  });
}

/**
 * Ouvre un inventaire : une ligne par ingrédient actif, plus les produits et
 * accompagnements suivis en stock qui n'ont pas de fiche recette (boissons…).
 */
export async function startInventory(): Promise<Result & { id?: string }> {
  const session = await requireStock(COUNT_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();

  const { data: inventory, error } = await admin
    .from('inventories')
    .insert({ structure_id: session.structureId, started_by: session.userId })
    .select('id')
    .single();
  if (error || !inventory) {
    return { success: false, error: await te(error?.code === '23505' ? 'stockControl.inventory.errors.alreadyOpen' : 'errors.createFailed') };
  }

  const [{ data: ingredients }, { data: stocks }, { data: recipes }] = await Promise.all([
    admin.from('ingredients').select('id').eq('structure_id', session.structureId).eq('is_active', true),
    admin
      .from('stocks')
      .select('product_id, accompaniment_id, products(is_deleted), accompaniments(is_deleted)')
      .eq('structure_id', session.structureId)
      .is('ingredient_id', null),
    admin.from('recipe_items').select('product_id, accompaniment_id').eq('structure_id', session.structureId),
  ]);
  const withRecipe = new Set((recipes || []).flatMap((r) => [r.product_id, r.accompaniment_id]).filter(Boolean));

  const lines = [
    ...(ingredients || []).map((i) => ({ inventory_id: inventory.id, item_type: 'ingredient', ingredient_id: i.id })),
    ...(stocks || [])
      .filter((s: any) => s.product_id && !s.products?.is_deleted && !withRecipe.has(s.product_id))
      .map((s: any) => ({ inventory_id: inventory.id, item_type: 'product', product_id: s.product_id })),
    ...(stocks || [])
      .filter((s: any) => s.accompaniment_id && !s.accompaniments?.is_deleted && !withRecipe.has(s.accompaniment_id))
      .map((s: any) => ({ inventory_id: inventory.id, item_type: 'accompaniment', accompaniment_id: s.accompaniment_id })),
  ];
  if (lines.length) {
    const { error: linesError } = await admin.from('inventory_lines').insert(lines);
    if (linesError) {
      await admin.from('inventories').delete().eq('id', inventory.id);
      return { success: false, error: await te('errors.createFailed') };
    }
  }
  revalidatePath('/stock/inventories');
  return { success: true, error: '', id: inventory.id };
}

export type InventoryLine = {
  id: string;
  item_type: InventoryItemType;
  name: string;
  unit: string | null;
  /** Stock théorique : actuel (inventaire en cours) ou figé à la validation. */
  expected: number;
  counted: number | null;
  unit_cost: number | null;
  counted_by: string | null;
};

export type InventoryDetail = InventorySummary & { lines: InventoryLine[]; can_validate: boolean };

export async function getInventory(id: string): Promise<InventoryDetail | null> {
  const session = await requireStock(COUNT_ROLES);
  if (!session) return null;
  const admin = getAdminSupabase();
  const { data: inventory } = await admin
    .from('inventories')
    .select('id, status, created_at, validated_at, variance_value, counted_lines, starter:users!started_by(first_name, last_name), validator:users!validated_by(first_name, last_name)')
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!inventory) return null;

  const { data: rows } = await admin
    .from('inventory_lines')
    .select(
      'id, item_type, ingredient_id, product_id, accompaniment_id, counted_quantity, expected_quantity, unit_cost, ' +
        'ingredients(name, unit, cost_per_unit), products(name), accompaniments(name), counter:users!counted_by(first_name, last_name)'
    )
    .eq('inventory_id', id);

  // Inventaire en cours : stock théorique actuel
  const current = new Map<string, number>();
  const inv = inventory as any;
  if (inv.status === 'DRAFT') {
    const { data: stocks } = await admin
      .from('stocks')
      .select('product_id, accompaniment_id, ingredient_id, quantity')
      .eq('structure_id', session.structureId);
    for (const s of stocks || []) {
      const key = (s.ingredient_id ?? s.product_id ?? s.accompaniment_id) as string;
      if (key) current.set(key, Number(s.quantity) || 0);
    }
  }

  const lines: InventoryLine[] = (rows || []).map((l: any) => {
    const itemId = l.ingredient_id ?? l.product_id ?? l.accompaniment_id;
    const name = l.ingredients?.name ?? l.products?.name ?? l.accompaniments?.name ?? '—';
    return {
      id: l.id,
      item_type: l.item_type,
      name,
      unit: l.ingredients?.unit ?? null,
      expected: inv.status === 'DRAFT' ? current.get(itemId) ?? 0 : Number(l.expected_quantity) || 0,
      counted: l.counted_quantity === null ? null : Number(l.counted_quantity),
      unit_cost: inv.status === 'DRAFT'
        ? (l.ingredients ? Number(l.ingredients.cost_per_unit) || 0 : null)
        : l.unit_cost === null ? null : Number(l.unit_cost),
      counted_by: fullName(l.counter),
    };
  });
  lines.sort((a, b) => a.item_type.localeCompare(b.item_type) || a.name.localeCompare(b.name));

  return {
    id: inv.id,
    status: inv.status,
    created_at: inv.created_at,
    validated_at: inv.validated_at,
    started_by: fullName(inv.starter),
    validated_by: fullName(inv.validator),
    counted_lines: lines.filter((l) => l.counted !== null).length,
    total_lines: lines.length,
    variance_value: inv.variance_value === null ? null : Number(inv.variance_value),
    lines,
    can_validate: VALIDATE_ROLES.includes(session.role),
  };
}

/** Enregistre (ou efface, avec null) la quantité comptée d'une ligne. */
export async function saveCount(lineId: string, quantity: number | null): Promise<Result> {
  const session = await requireStock(COUNT_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
    return { success: false, error: await te('stockControl.inventory.errors.quantityInvalid') };
  }
  const admin = getAdminSupabase();
  // La ligne doit appartenir à un inventaire en cours du point.
  const { data: line } = await admin
    .from('inventory_lines')
    .select('id, inventories!inner(structure_id, status)')
    .eq('id', lineId)
    .eq('inventories.structure_id', session.structureId)
    .maybeSingle();
  const parent = line ? ((Array.isArray(line.inventories) ? line.inventories[0] : line.inventories) as { status?: string }) : null;
  if (!line || parent?.status !== 'DRAFT') return { success: false, error: await te('stockControl.inventory.errors.closed') };

  const { error } = await admin
    .from('inventory_lines')
    .update({
      counted_quantity: quantity === null ? null : Math.round(quantity * 1000) / 1000,
      counted_by: quantity === null ? null : session.userId,
      counted_at: quantity === null ? null : new Date().toISOString(),
    })
    .eq('id', lineId);
  if (error) return { success: false, error: await te('errors.updateFailed') };
  return { success: true, error: '' };
}

/** Valide l'inventaire : le stock prend les quantités comptées (lignes non comptées ignorées). */
export async function validateInventory(id: string): Promise<Result & { varianceValue?: number }> {
  const session = await requireStock(VALIDATE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data: inventory } = await admin.from('inventories').select('id').eq('id', id).eq('structure_id', session.structureId).maybeSingle();
  if (!inventory) return { success: false, error: await te('stockControl.inventory.errors.notFound') };

  const { data, error } = await admin.rpc('validate_inventory', { p_inventory_id: id, p_user_id: session.userId });
  if (error) {
    return { success: false, error: await te(error.message?.includes('inventory_closed') ? 'stockControl.inventory.errors.closed' : 'errors.updateFailed') };
  }
  revalidatePath('/stock');
  revalidatePath('/stock/inventories');
  revalidatePath(`/stock/inventories/${id}`);
  revalidatePath('/stock/ingredients');
  return { success: true, error: '', varianceValue: Number((data as { variance_value?: number })?.variance_value) || 0 };
}

export async function cancelInventory(id: string): Promise<Result> {
  const session = await requireStock(VALIDATE_ROLES);
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { data, error } = await getAdminSupabase()
    .from('inventories')
    .update({ status: 'CANCELLED' })
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .eq('status', 'DRAFT')
    .select('id');
  if (error || !data?.length) return { success: false, error: await te('stockControl.inventory.errors.closed') };
  revalidatePath('/stock/inventories');
  return { success: true, error: '' };
}
