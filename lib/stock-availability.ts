import { getAdminSupabase } from '@/lib/supabase';
import { grossQuantity } from '@/lib/recipes';
import { loadRecipeLines, type RecipeRow } from '@/lib/stock';
import { te } from '@/lib/i18n/server';

// Disponibilité en stock au moment de commander — module serveur (pas une Server Action).
//
// Le stock ne sort qu'à l'encaissement : ce qui reste vraiment, c'est le stock moins ce que
// les commandes en cours (pas encore payées ni annulées) vont consommer.
// Un plat avec fiche recette dépend de ses ingrédients (ou, ancien format, des produits qui
// le composent) ; sinon il est suivi lui-même — comme à la sortie de stock (lib/stock.ts).
// Comme sur la page Stock, un article sans ligne de stock est à 0 : il est en rupture.

/** Nombre d'unités encore commandables ; null = point sans le module Stock (illimité). */
export type Available = number | null;

export type StockAvailability = {
  products: Map<string, Available>;
  accompaniments: Map<string, Available>;
};

export type StockLine = {
  productId: string;
  quantity: number;
  accompaniments?: { accompanimentId: string; quantity: number }[];
};

type Key = string; // 'product:<id>' | 'accompaniment:<id>' | 'ingredient:<id>'
type Recipes = Awaited<ReturnType<typeof loadRecipeLines>> & {
  /** Ancien format product_recipes : produit → produits qui le composent (quantité par unité). */
  legacy?: Map<string, { productId: string; quantity: number }[]>;
};

const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED'];

/** Ce qu'une unité d'un article consomme : ses ingrédients s'il a une recette, sinon lui-même. */
export function perUnit(kind: 'product' | 'accompaniment', id: string, recipes: Recipes): Map<Key, number> {
  const lines: RecipeRow[] = (kind === 'product' ? recipes.byProduct : recipes.byAccompaniment).get(id) ?? [];
  const needs = new Map<Key, number>();
  const legacy = kind === 'product' && !lines.length ? recipes.legacy?.get(id) ?? [] : [];
  if (legacy.length) {
    for (const l of legacy) needs.set(`product:${l.productId}`, (needs.get(`product:${l.productId}`) ?? 0) + l.quantity);
    return needs;
  }
  if (!lines.length) {
    needs.set(`${kind}:${id}`, 1);
    return needs;
  }
  for (const line of lines) {
    const key = `ingredient:${line.ingredient_id}`;
    needs.set(key, (needs.get(key) ?? 0) + grossQuantity(line));
  }
  return needs;
}

export function addNeeds(total: Map<Key, number>, unit: Map<Key, number>, quantity: number) {
  for (const [key, q] of unit) total.set(key, (total.get(key) ?? 0) + q * quantity);
}

async function hasStockModule(structureId: string) {
  const { data } = await getAdminSupabase().from('structures').select('modules').eq('id', structureId).maybeSingle();
  return Boolean((data?.modules as string[] | null)?.includes('STOCK'));
}

/** Quantités en stock (les articles sans ligne `stocks` sont absents : 0). */
async function loadStock(structureId: string, keys: Key[]) {
  const stock = new Map<Key, number>();
  const ids = { product: [] as string[], accompaniment: [] as string[], ingredient: [] as string[] };
  for (const key of keys) {
    const [kind, id] = key.split(':') as [keyof typeof ids, string];
    ids[kind].push(id);
  }
  const admin = getAdminSupabase();
  const queries = (Object.keys(ids) as (keyof typeof ids)[])
    .filter((kind) => ids[kind].length)
    .map(async (kind) => {
      const column = `${kind}_id`;
      const { data } = await admin.from('stocks').select(`${column}, quantity`).eq('structure_id', structureId).in(column, ids[kind]);
      for (const row of (data || []) as unknown as Record<string, unknown>[]) stock.set(`${kind}:${row[column]}`, Number(row.quantity) || 0);
    });
  await Promise.all(queries);
  return stock;
}

/** Ce que les commandes en cours (non payées) vont sortir du stock. */
async function loadReserved(structureId: string, excludeOrderId?: string | null) {
  const admin = getAdminSupabase();
  let query = admin
    .from('orders')
    .select('id, order_items(product_id, quantity), order_accompaniments(accompaniment_id, quantity)')
    .eq('structure_id', structureId)
    .in('status', OPEN_STATUSES);
  if (excludeOrderId) query = query.neq('id', excludeOrderId);
  const { data } = await query;
  const products = new Map<string, number>();
  const accompaniments = new Map<string, number>();
  for (const order of (data || []) as any[]) {
    for (const item of order.order_items || []) {
      if (item.product_id) products.set(item.product_id, (products.get(item.product_id) ?? 0) + (Number(item.quantity) || 0));
    }
    for (const acc of order.order_accompaniments || []) {
      if (acc.accompaniment_id) accompaniments.set(acc.accompaniment_id, (accompaniments.get(acc.accompaniment_id) ?? 0) + (Number(acc.quantity) || 0));
    }
  }
  return { products, accompaniments };
}

/** Stock restant (stock − commandes en cours) des clés suivies, avec les recettes utiles. */
async function remainingStock(structureId: string, productIds: string[], accompanimentIds: string[]) {
  const reserved = await loadReserved(structureId);
  const allProducts = [...new Set([...productIds, ...reserved.products.keys()])];
  const allAccompaniments = [...new Set([...accompanimentIds, ...reserved.accompaniments.keys()])];
  const recipes: Recipes = await loadRecipeLines(allProducts, allAccompaniments);
  recipes.legacy = await loadLegacyRecipes(allProducts.filter((id) => !recipes.byProduct.has(id)));

  const reservedNeeds = new Map<Key, number>();
  for (const [id, q] of reserved.products) addNeeds(reservedNeeds, perUnit('product', id, recipes), q);
  for (const [id, q] of reserved.accompaniments) addNeeds(reservedNeeds, perUnit('accompaniment', id, recipes), q);

  const wantedKeys = new Set<Key>();
  for (const id of productIds) for (const key of perUnit('product', id, recipes).keys()) wantedKeys.add(key);
  for (const id of accompanimentIds) for (const key of perUnit('accompaniment', id, recipes).keys()) wantedKeys.add(key);

  const stock = await loadStock(structureId, [...wantedKeys]);
  const remaining = new Map<Key, number>();
  for (const key of wantedKeys) remaining.set(key, (stock.get(key) ?? 0) - (reservedNeeds.get(key) ?? 0));
  return { remaining, recipes };
}

/** Ancien format de recette (product_recipes), encore utilisé à la sortie de stock. */
async function loadLegacyRecipes(productIds: string[]) {
  const legacy = new Map<string, { productId: string; quantity: number }[]>();
  if (!productIds.length) return legacy;
  const { data, error } = await getAdminSupabase().from('product_recipes').select('product_id, ingredient_id, quantity').in('product_id', productIds);
  if (error) return legacy;
  for (const row of data || []) {
    const list = legacy.get(row.product_id as string) ?? [];
    list.push({ productId: row.ingredient_id as string, quantity: Number(row.quantity) || 0 });
    legacy.set(row.product_id as string, list);
  }
  return legacy;
}

/** Unités commandables d'un article : la ressource la plus limitante (absente du stock = 0). */
export function unitsFor(unit: Map<Key, number>, remaining: Map<Key, number>): Available {
  let units = Infinity;
  for (const [key, need] of unit) {
    if (need <= 0) continue;
    const possible = Math.max(0, Math.floor(((remaining.get(key) ?? 0) + 1e-9) / need));
    units = Math.min(units, possible);
  }
  return Number.isFinite(units) ? units : null; // recette sans quantité : rien ne la limite
}

/** Disponibilité des produits et accompagnements d'un point (vide sans le module Stock). */
export async function getStockAvailability(
  structureId: string,
  productIds: string[],
  accompanimentIds: string[] = []
): Promise<StockAvailability> {
  const result: StockAvailability = { products: new Map(), accompaniments: new Map() };
  if (!(productIds.length || accompanimentIds.length) || !(await hasStockModule(structureId))) return result;
  try {
    const { remaining, recipes } = await remainingStock(structureId, productIds, accompanimentIds);
    for (const id of productIds) result.products.set(id, unitsFor(perUnit('product', id, recipes), remaining));
    for (const id of accompanimentIds) result.accompaniments.set(id, unitsFor(perUnit('accompaniment', id, recipes), remaining));
  } catch (error) {
    // Jamais bloquant : en cas d'erreur, rien n'est marqué en rupture
    console.error('[stock] disponibilité :', error);
  }
  return result;
}

/** Version sérialisable (pages serveur → composants client). */
export function availabilityRecord(map: Map<string, Available>): Record<string, Available> {
  return Object.fromEntries(map);
}

export type StockShortage = { kind: 'product' | 'accompaniment'; id: string; available: number };

/**
 * Vérifie qu'une commande (ou un ajout) tient dans le stock restant, ingrédients partagés
 * compris. Renvoie le premier article qui manque, ou null si tout est disponible.
 */
export async function findStockShortage(structureId: string, lines: StockLine[]): Promise<StockShortage | null> {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const accompanimentIds = [...new Set(lines.flatMap((l) => (l.accompaniments ?? []).map((a) => a.accompanimentId)))];
  if (!productIds.length || !(await hasStockModule(structureId))) return null;
  try {
    const { remaining, recipes } = await remainingStock(structureId, productIds, accompanimentIds);
    const needed = new Map<Key, number>();
    const owner = new Map<Key, { kind: 'product' | 'accompaniment'; id: string; unit: Map<Key, number> }>();
    const add = (kind: 'product' | 'accompaniment', id: string, quantity: number) => {
      const unit = perUnit(kind, id, recipes);
      addNeeds(needed, unit, quantity);
      for (const key of unit.keys()) if (!owner.has(key)) owner.set(key, { kind, id, unit });
    };
    for (const line of lines) {
      add('product', line.productId, line.quantity);
      for (const acc of line.accompaniments ?? []) add('accompaniment', acc.accompanimentId, acc.quantity);
    }
    for (const [key, need] of needed) {
      if (need > (remaining.get(key) ?? 0) + 1e-9) {
        const item = owner.get(key)!;
        return { kind: item.kind, id: item.id, available: unitsFor(item.unit, remaining) ?? 0 };
      }
    }
  } catch (error) {
    console.error('[stock] contrôle de la commande :', error);
  }
  return null;
}

/** Message d'erreur « rupture » avec le nom de l'article. */
export async function shortageName(shortage: StockShortage) {
  const table = shortage.kind === 'product' ? 'products' : 'accompaniments';
  const { data } = await getAdminSupabase().from(table).select('name').eq('id', shortage.id).maybeSingle();
  return (data?.name as string | undefined) ?? '—';
}

/**
 * Contrôle avant d'enregistrer des articles : renvoie le message d'erreur à afficher
 * (rupture ou stock insuffisant), ou null. La quantité d'un accompagnement suit celle du
 * plat multipliée par la quantité prévue pour ce plat (product_accompaniments).
 */
export async function stockErrorFor(
  structureId: string,
  items: { productId: string; quantity: number; accompanimentIds?: string[] }[]
): Promise<string | null> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const multiplier = new Map<string, number>();
  if (items.some((i) => i.accompanimentIds?.length)) {
    const { data } = await getAdminSupabase()
      .from('product_accompaniments')
      .select('product_id, accompaniment_id, quantity')
      .in('product_id', productIds);
    for (const m of data || []) multiplier.set(`${m.product_id}:${m.accompaniment_id}`, Number(m.quantity) || 1);
  }
  const shortage = await findStockShortage(
    structureId,
    items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      accompaniments: (i.accompanimentIds ?? []).map((a) => ({
        accompanimentId: a,
        quantity: i.quantity * (multiplier.get(`${i.productId}:${a}`) ?? 1),
      })),
    }))
  );
  if (!shortage) return null;
  const name = await shortageName(shortage);
  return shortage.available > 0
    ? te('errors.notEnoughStock', { name, count: shortage.available })
    : te('errors.outOfStock', { name });
}

/** Ajout d'un accompagnement à un plat déjà commandé. */
export async function stockErrorAccompaniment(structureId: string, accompanimentId: string, quantity: number): Promise<string | null> {
  const { accompaniments } = await getStockAvailability(structureId, [], [accompanimentId]);
  const available = accompaniments.get(accompanimentId);
  if (available == null || available >= quantity) return null;
  const name = await shortageName({ kind: 'accompaniment', id: accompanimentId, available });
  return available > 0 ? te('errors.notEnoughStock', { name, count: available }) : te('errors.outOfStock', { name });
}
