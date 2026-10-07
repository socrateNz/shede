// Commandes suggérées (module PREVISIONS) — calcul pur, sans base.
//
// Pour chaque article stocké (ingrédient, ou produit revendu sans fiche recette) :
//   besoin = consommation prévue jusqu'à la livraison SUIVANTE du fournisseur
//            (la commande passée aujourd'hui doit tenir jusque-là)
//          + stock de sécurité (seuil d'alerte)
//          − stock actuel − quantités commandées non encore reçues
// arrondi au conditionnement supérieur. Rupture signalée si le stock ne tient
// pas jusqu'à la prochaine livraison.

import { addDays } from '@/lib/forecast';
import { nextDeliveryDate } from '@/lib/purchasing';

export type ItemKey = `ingredient:${string}` | `product:${string}`;

export type StockItem = { key: ItemKey; name: string; unit: string | null; stock: number; threshold: number };
export type SupplierOffer = {
  supplierItemId: string;
  supplierId: string;
  key: ItemKey;
  packLabel: string;
  packSize: number;
  unitPrice: number;
  preferred: boolean;
};
export type SupplierInfo = { id: string; name: string; deliveryDays: number[]; leadTimeDays: number; minOrderAmount: number };

/** Consommation par article pour une unité vendue de chaque produit. */
export type UsageByProduct = Map<string, { key: ItemKey; quantity: number }[]>;

export type Suggestion = {
  key: ItemKey;
  name: string;
  unit: string | null;
  stock: number;
  incoming: number;
  /** Consommation prévue jusqu'à la livraison suivante */
  consumption: number;
  safety: number;
  need: number;
  packs: number;
  offer: SupplierOffer | null;
  nextDelivery: string | null;
  coverUntil: string | null;
  /** Le stock ne tient pas jusqu'à la prochaine livraison */
  stockoutRisk: boolean;
};

export type SupplierSuggestion = { supplier: SupplierInfo | null; lines: Suggestion[]; total: number; belowMinimum: boolean };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Livraison possible suivant une date (jours de livraison ; à la demande : 7 jours plus tard). */
function deliveryAfter(supplier: SupplierInfo, day: string) {
  if (!supplier.deliveryDays.length) return addDays(day, 7);
  return nextDeliveryDate(supplier.deliveryDays, 0, new Date(`${addDays(day, 1)}T00:00:00Z`));
}

export function computeSuggestions(input: {
  today: string;
  /** Ventes prévues : date → produit → quantité (couvrir au moins 14 jours) */
  forecast: Map<string, Map<string, number>>;
  usage: UsageByProduct;
  items: StockItem[];
  offers: SupplierOffer[];
  suppliers: SupplierInfo[];
  /** Quantités commandées non reçues, en unité de stock */
  incoming: Map<ItemKey, number>;
}): SupplierSuggestion[] {
  const supplierById = new Map(input.suppliers.map((s) => [s.id, s]));
  const forecastDays = [...input.forecast.keys()].sort();
  const lastForecastDay = forecastDays[forecastDays.length - 1] ?? input.today;

  // Consommation prévue par article et par jour
  const daily = new Map<ItemKey, Map<string, number>>();
  for (const [day, products] of input.forecast) {
    for (const [productId, sold] of products) {
      for (const use of input.usage.get(productId) ?? []) {
        if (!daily.has(use.key)) daily.set(use.key, new Map());
        const perDay = daily.get(use.key)!;
        perDay.set(day, (perDay.get(day) ?? 0) + sold * use.quantity);
      }
    }
  }
  const consumptionBetween = (key: ItemKey, from: string, to: string) => {
    let total = 0;
    for (const [day, qty] of daily.get(key) ?? []) if (day >= from && day < to) total += qty;
    return total;
  };

  // Offre retenue : fournisseur préféré, sinon le moins cher à l'unité de stock
  const bestOffer = new Map<ItemKey, SupplierOffer>();
  for (const offer of input.offers) {
    if (!supplierById.has(offer.supplierId)) continue;
    const current = bestOffer.get(offer.key);
    const cheaper = !current || offer.unitPrice / offer.packSize < current.unitPrice / current.packSize;
    if (!current || (offer.preferred && !current.preferred) || (offer.preferred === current.preferred && cheaper)) bestOffer.set(offer.key, offer);
  }

  const suggestions: Suggestion[] = [];
  for (const item of input.items) {
    if (!daily.has(item.key) && item.stock > item.threshold) continue; // ni consommé ni sous le seuil
    const offer = bestOffer.get(item.key) ?? null;
    const supplier = offer ? supplierById.get(offer.supplierId)! : null;
    const nextDelivery = supplier ? nextDeliveryDate(supplier.deliveryDays, supplier.leadTimeDays, new Date(`${input.today}T12:00:00Z`)) : null;
    // Sans fournisseur : couvrir 7 jours
    const coverUntil = supplier && nextDelivery ? deliveryAfter(supplier, nextDelivery) : addDays(input.today, 7);
    const horizonEnd = coverUntil > addDays(lastForecastDay, 1) ? addDays(lastForecastDay, 1) : coverUntil;

    const stock = Math.max(0, item.stock);
    const incoming = input.incoming.get(item.key) ?? 0;
    const consumption = consumptionBetween(item.key, input.today, horizonEnd);
    const safety = Math.max(0, item.threshold);
    const need = consumption + safety - stock - incoming;
    const untilDelivery = nextDelivery ? consumptionBetween(item.key, input.today, nextDelivery) : 0;
    const stockoutRisk = nextDelivery !== null && stock + incoming < untilDelivery;
    if (need <= 0 && !stockoutRisk) continue;

    suggestions.push({
      key: item.key,
      name: item.name,
      unit: item.unit,
      stock: round3(item.stock),
      incoming: round3(incoming),
      consumption: round3(consumption),
      safety: round3(safety),
      need: round3(Math.max(0, need)),
      packs: offer && need > 0 ? Math.ceil(round3(need / offer.packSize)) : 0,
      offer,
      nextDelivery,
      coverUntil,
      stockoutRisk,
    });
  }

  // Regroupement par fournisseur ; articles sans fournisseur à la fin
  const groups = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    const id = s.offer?.supplierId ?? '';
    groups.set(id, [...(groups.get(id) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([id, lines]) => {
      const supplier = id ? supplierById.get(id)! : null;
      const total = Math.round(lines.reduce((sum, l) => sum + (l.offer ? l.packs * l.offer.unitPrice : 0), 0));
      return {
        supplier,
        lines: lines.sort((a, b) => Number(b.stockoutRisk) - Number(a.stockoutRisk) || a.name.localeCompare(b.name)),
        total,
        belowMinimum: Boolean(supplier && supplier.minOrderAmount > 0 && total > 0 && total < supplier.minOrderAmount),
      };
    })
    .sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1) || b.total - a.total);
}
