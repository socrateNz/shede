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
  };
}

/** Prix TTC payé par le client, selon le régime de TVA du point. */
export function priceWithTax(price: number, structure: Record<string, any>) {
  return computeTax(Number(price) || 0, toTaxSettings(structure)).total;
}

export function serializeMenu(structure: Record<string, any>, products: any[]) {
  return products.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    description: p.description ?? null,
    category: p.category ?? null,
    image_url: p.image_url ?? null,
    price: Number(p.price) || 0,
    price_with_tax: priceWithTax(p.price, structure),
    is_available: p.is_available !== false,
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
  }));
}
