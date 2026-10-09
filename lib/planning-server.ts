import { getAdminSupabase } from '@/lib/supabase';
import { addDays, localToday } from '@/lib/forecast';
import { computeForecast, loadSales } from '@/lib/forecast-server';
import { grossQuantity, type RecipeUnit } from '@/lib/recipes';
import { computeSuggestions, type ItemKey, type SupplierInfo, type SupplierOffer, type UsageByProduct } from '@/lib/replenishment';
import { fetchAll } from '@/lib/pagination';

// Commandes suggérées et plan de production (module PREVISIONS) — accès base.

/** Ce que consomme une unité vendue de chaque produit : ingrédients de sa recette, sinon lui-même s'il est suivi en stock. */
async function loadUsage(structureId: string, trackedProducts: Set<string>): Promise<UsageByProduct> {
  const usage: UsageByProduct = new Map();
  // Lignes de recettes : produits × ingrédients, lues par tranches (limite de 1000 lignes de l'API).
  const recipes = await fetchAll<any>((a, b) =>
    getAdminSupabase()
      .from('recipe_items')
      .select('product_id, ingredient_id, quantity, unit, waste_percent')
      .eq('structure_id', structureId)
      .not('product_id', 'is', null)
      .order('id')
      .range(a, b),
  );
  for (const r of recipes || []) {
    const list = usage.get(r.product_id as string) ?? [];
    list.push({
      key: `ingredient:${r.ingredient_id}`,
      quantity: grossQuantity({ quantity: Number(r.quantity), unit: r.unit as RecipeUnit, waste_percent: Number(r.waste_percent) || 0 }),
    });
    usage.set(r.product_id as string, list);
  }
  for (const productId of trackedProducts) if (!usage.has(productId)) usage.set(productId, [{ key: `product:${productId}`, quantity: 1 }]);
  return usage;
}

/** Commandes suggérées, regroupées par fournisseur. */
export async function loadSuggestions(structureId: string) {
  const admin = getAdminSupabase();
  const today = localToday();
  const forecast = await computeForecast(structureId, 14);

  const [{ data: ingredients }, { data: stocks }, { data: offers }, { data: suppliers }, { data: openLines }] = await Promise.all([
    admin.from('ingredients').select('id, name, unit, stocks(quantity, threshold)').eq('structure_id', structureId).eq('is_active', true),
    admin
      .from('stocks')
      .select('product_id, quantity, threshold, products(name, is_deleted)')
      .eq('structure_id', structureId)
      .not('product_id', 'is', null),
    admin
      .from('supplier_items')
      .select('id, supplier_id, ingredient_id, product_id, pack_label, pack_size, unit_price, is_preferred')
      .eq('structure_id', structureId)
      .eq('is_active', true),
    admin
      .from('suppliers')
      .select('id, name, delivery_days, lead_time_days, min_order_amount')
      .eq('structure_id', structureId)
      .eq('is_active', true),
    admin
      .from('purchase_order_lines')
      .select('ingredient_id, product_id, pack_size, quantity, received_quantity, purchase_orders!inner(structure_id, status)')
      .eq('purchase_orders.structure_id', structureId)
      .in('purchase_orders.status', ['SENT', 'PARTIAL']),
  ]);

  // Produits suivis en stock sans fiche recette (boissons…) : ils se commandent eux-mêmes
  const recipeOwners = await fetchAll<{ product_id: string }>((a, b) =>
    admin.from('recipe_items').select('product_id').eq('structure_id', structureId).not('product_id', 'is', null).order('id').range(a, b),
  );
  const withRecipe = new Set((recipeOwners || []).map((r) => r.product_id as string));
  const trackedProducts = (stocks || []).filter((s: any) => !s.products?.is_deleted && !withRecipe.has(s.product_id));

  const items = [
    ...(ingredients || []).map((i: any) => ({
      key: `ingredient:${i.id}` as ItemKey,
      name: i.name as string,
      unit: i.unit as string,
      stock: Number(i.stocks?.[0]?.quantity) || 0,
      threshold: Number(i.stocks?.[0]?.threshold) || 0,
    })),
    ...trackedProducts.map((s: any) => ({
      key: `product:${s.product_id}` as ItemKey,
      name: s.products?.name ?? '—',
      unit: null,
      stock: Number(s.quantity) || 0,
      threshold: Number(s.threshold) || 0,
    })),
  ];

  const incoming = new Map<ItemKey, number>();
  for (const l of openLines || []) {
    const key = (l.ingredient_id ? `ingredient:${l.ingredient_id}` : `product:${l.product_id}`) as ItemKey;
    const remaining = Math.max(0, Number(l.quantity) - Number(l.received_quantity)) * Number(l.pack_size);
    incoming.set(key, (incoming.get(key) ?? 0) + remaining);
  }

  const forecastMap = new Map(forecast.days.map((d) => [d.date, new Map(d.products.map((p) => [p.product_id, p.quantity]))]));
  const usage = await loadUsage(structureId, new Set(trackedProducts.map((s: any) => s.product_id as string)));

  const groups = computeSuggestions({
    today,
    forecast: forecastMap,
    usage,
    items,
    offers: (offers || []).map(
      (o): SupplierOffer => ({
        supplierItemId: o.id,
        supplierId: o.supplier_id,
        key: (o.ingredient_id ? `ingredient:${o.ingredient_id}` : `product:${o.product_id}`) as ItemKey,
        packLabel: o.pack_label,
        packSize: Number(o.pack_size),
        unitPrice: Number(o.unit_price),
        preferred: Boolean(o.is_preferred),
      })
    ),
    suppliers: (suppliers || []).map(
      (s): SupplierInfo => ({
        id: s.id,
        name: s.name,
        deliveryDays: ((s.delivery_days as number[] | null) ?? []).map(Number),
        leadTimeDays: Number(s.lead_time_days) || 0,
        minOrderAmount: Number(s.min_order_amount) || 0,
      })
    ),
    incoming,
  });
  return { today, groups, hasPurchasing: offers !== null, openDays: forecast.openDays };
}

// ── Plan de production ───────────────────────────────────

/** Tranches horaires du plan (heure locale de début, incluse ; fin exclue). */
export const PRODUCTION_SLOTS = [
  { key: 'morning', from: 0, to: 11 },
  { key: 'lunch', from: 11, to: 15 },
  { key: 'afternoon', from: 15, to: 18 },
  { key: 'evening', from: 18, to: 24 },
] as const;
export type SlotKey = (typeof PRODUCTION_SLOTS)[number]['key'];

/** Plan de production d'un jour (aujourd'hui ou demain) : par produit et par tranche horaire, et mise en place. */
export async function loadProductionPlan(structureId: string, dayOffset: 0 | 1) {
  const admin = getAdminSupabase();
  const today = localToday();
  const date = addDays(today, dayOffset);
  const [forecast, profileResult, soldToday, { data: products }, recipes] = await Promise.all([
    computeForecast(structureId, 2),
    admin.rpc('hourly_sales_profile', { p_structure_id: structureId, p_from: addDays(today, -28), p_to: addDays(today, -1) }),
    dayOffset === 0 ? loadSales(structureId, today, today) : Promise.resolve([]),
    admin.from('products').select('id, name, destination').eq('structure_id', structureId).eq('is_deleted', false),
    fetchAll<any>((a, b) =>
      admin
        .from('recipe_items')
        .select('product_id, ingredient_id, quantity, unit, waste_percent, ingredients(name, unit)')
        .eq('structure_id', structureId)
        .not('product_id', 'is', null)
        .order('id')
        .range(a, b),
    ),
  ]);
  if (profileResult.error) throw profileResult.error;

  // Part des ventes de chaque tranche horaire (4 dernières semaines)
  const profile = (profileResult.data || []) as { hour: number; quantity: number }[];
  const totalQty = profile.reduce((s, h) => s + Number(h.quantity), 0);
  const shares = PRODUCTION_SLOTS.map((slot) => ({
    key: slot.key as SlotKey,
    from: slot.from,
    to: slot.to,
    share: totalQty > 0 ? profile.filter((h) => h.hour >= slot.from && h.hour < slot.to).reduce((s, h) => s + Number(h.quantity), 0) / totalQty : 0,
  })).filter((s) => s.share > 0 || totalQty === 0);

  const day = forecast.days.find((d) => d.date === date)!;
  const sold = new Map(soldToday.map((r) => [r.product_id, r.quantity]));
  const productInfo = new Map((products || []).map((p) => [p.id as string, p]));
  const lines = day.products
    .filter((p) => p.quantity > 0)
    .map((p) => {
      const info = productInfo.get(p.product_id);
      return {
        product_id: p.product_id,
        name: (info?.name as string) ?? '—',
        destination: ((info?.destination as string) || 'CUISINE') as 'CUISINE' | 'BAR',
        forecast: p.quantity,
        sold: sold.get(p.product_id) ?? 0,
        slots: Object.fromEntries(shares.map((s) => [s.key, Math.round(p.quantity * (totalQty > 0 ? s.share : 1 / shares.length) * 10) / 10])),
      };
    })
    .sort((a, b) => b.forecast - a.forecast);

  // Mise en place : ingrédients nécessaires pour la production prévue
  const needs = new Map<string, { name: string; unit: string; quantity: number }>();
  for (const r of (recipes || []) as any[]) {
    const line = lines.find((l) => l.product_id === r.product_id);
    if (!line) continue;
    const remaining = dayOffset === 0 ? Math.max(0, line.forecast - line.sold) : line.forecast;
    const quantity = grossQuantity({ quantity: Number(r.quantity), unit: r.unit, waste_percent: Number(r.waste_percent) || 0 }) * remaining;
    const current = needs.get(r.ingredient_id) ?? { name: r.ingredients?.name ?? '—', unit: r.ingredients?.unit ?? '', quantity: 0 };
    current.quantity += quantity;
    needs.set(r.ingredient_id, current);
  }

  return {
    date,
    today,
    holiday: day.holiday,
    event: day.event,
    slots: shares.map((s) => ({ key: s.key, from: s.from, to: s.to, share: Math.round(s.share * 100) })),
    lines,
    ingredients: [...needs.values()]
      .map((n) => ({ ...n, quantity: Math.round(n.quantity * 1000) / 1000 }))
      .filter((n) => n.quantity > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
