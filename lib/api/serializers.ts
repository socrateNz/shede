import { computeTax, toTaxSettings } from '@/lib/tax';

// Représentation publique des données (stable : les marketplaces s'y fient).
// Montants en francs CFA (XAF), entiers.

export function serializePoint(structure: Record<string, any>) {
  const tax = toTaxSettings(structure);
  return {
    id: structure.id as string,
    name: structure.name as string,
    type: structure.type ?? 'RESTAURANT',
    phone: structure.phone ?? null,
    address: structure.address ?? null,
    city: structure.city ?? null,
    country: structure.country ?? null,
    currency: 'XAF',
    tax: { rate: tax.rate, prices_include_tax: tax.pricesIncludeTax },
    takeaway_fee: Number(structure.takeaway_fee) || 0,
    logo_url: structure.logo_url ?? null,
    // Le restaurant a suspendu les commandes marketplace (POST /orders répond alors 409 point_paused).
    paused: Boolean(structure.api_paused),
    accepting_orders: !structure.api_paused && structure.is_active !== false,
    // Livraison par les livreurs du restaurant possible (voir GET /delivery-zones).
    restaurant_delivery: Boolean((structure.modules as string[] | null)?.includes('LIVRAISON')),
  };
}

/** Zone de livraison du restaurant ; les frais suivent le régime de TVA du point. */
export function serializeDeliveryZone(zone: Record<string, any>, structure: Record<string, any>) {
  return {
    id: zone.id as string,
    name: zone.name as string,
    fee: Number(zone.fee) || 0,
    fee_with_tax: priceWithTax(zone.fee, structure),
  };
}

/** Prix TTC payé par le client, selon le régime de TVA du point. */
export function priceWithTax(price: number, structure: Record<string, any>) {
  return computeTax(Number(price) || 0, toTaxSettings(structure)).total;
}

export function serializeMenu(
  structure: Record<string, any>,
  products: any[],
  categoriesByProduct: Map<string, { id: string; name: string; parent_id: string | null }[]> = new Map(),
) {
  return products.map((p) => {
    const categories = categoriesByProduct.get(p.id) ?? [];
    return {
      id: p.id as string,
      name: p.name as string,
      description: p.description ?? null,
      // Première catégorie (compatibilité) ; la liste complète est dans `categories`.
      category: categories[0]?.name ?? p.category ?? null,
      categories,
      image_url: p.image_url ?? null,
      price: Number(p.price) || 0,
      price_with_tax: priceWithTax(p.price, structure),
      is_available: p.is_available !== false,
      // false : ne peut pas être commandé via l'API (toutes les commandes marketplace sont livrées).
      is_deliverable: p.is_deliverable !== false,
      accompaniments: (p.product_accompaniments || [])
        .map((pa: any) => ({ max_quantity: Number(pa.quantity) || 1, ...pa.accompaniments }))
        .filter((a: any) => a.id && !a.is_deleted)
        .map((a: any) => ({
          id: a.id as string,
          name: a.name as string,
          price: Number(a.price) || 0,
          price_with_tax: priceWithTax(a.price, structure),
          max_quantity: a.max_quantity,
          is_available: a.is_available !== false,
        })),
    };
  });
}

/**
 * Catégorie du menu. parent_id : null pour une catégorie principale, sinon l'id
 * de sa catégorie (un seul niveau de sous-catégories). position : ordre parmi
 * les catégories de même niveau.
 */
export function serializeCategory(category: { id: string; name: string; parent_id: string | null; position: number }) {
  return { id: category.id, name: category.name, parent_id: category.parent_id, position: category.position };
}
