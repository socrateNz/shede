import { getAdminSupabase } from '@/lib/supabase';
import { computeTax, type TaxSettings } from '@/lib/tax';
import { getStructureTaxSettings, saveTaxSnapshot } from '@/lib/fiscal';

// Total d'une commande — module serveur, PAS une Server Action : il ne doit pas
// pouvoir être appelé depuis le navigateur. Les appelants (caisse, app client,
// API) vérifient eux-mêmes les droits sur la commande.
//
// computeOrderAmounts() est un calcul pur (sans base) : il sert aussi au mode
// test de l'API, qui simule une commande sans rien enregistrer.

export type PricedItem = { product_id: string; unit_price: number; total_price: number; quantity: number; is_price_counted?: boolean | null };
export type PricedAccompaniment = { total_price_snapshot: number; is_price_counted?: boolean | null };
type Promotion = Record<string, any>;

/** Promotions automatiques actives du point, plus le code promo rattaché s'il est valide. */
export async function loadActivePromotions(structureId: string, promotionId?: string | null): Promise<Promotion[]> {
  const admin = getAdminSupabase();
  const now = new Date().toISOString();
  const { data: autoPromos } = await admin
    .from('promotions')
    .select('*')
    .eq('structure_id', structureId)
    .eq('is_active', true)
    .in('promo_mode', ['STANDARD', 'BUY_X_GET_Y'])
    .lte('start_date', now)
    .gte('end_date', now);

  const promos = [...(autoPromos || [])];
  if (promotionId) {
    const { data: selectedPromo } = await admin.from('promotions').select('*').eq('id', promotionId).single();
    if (selectedPromo && selectedPromo.is_active && selectedPromo.promo_mode === 'CODE') {
      const current = new Date();
      if (current >= new Date(selectedPromo.start_date) && current <= new Date(selectedPromo.end_date)) {
        promos.push(selectedPromo);
      }
    }
  }
  return promos;
}

/** Calcul pur : sous-total, remise totale (promotions + manuelle), TVA et total à payer. */
export function computeOrderAmounts(input: {
  productItems: PricedItem[];
  accompaniments: PricedAccompaniment[];
  promotions: Promotion[];
  taxSettings: TaxSettings;
  manualDiscount?: number;
  tip?: number;
  takeawayFee?: number;
  deliveryFee?: number;
}) {
  const counted = (value: number, flag?: boolean | null) => ((flag ?? true) ? Number(value) || 0 : 0);
  const productSubtotal = input.productItems.reduce((sum, item) => sum + counted(item.total_price, item.is_price_counted), 0);
  const accSubtotal = input.accompaniments.reduce((sum, a) => sum + counted(a.total_price_snapshot, a.is_price_counted), 0);
  const subtotal = productSubtotal + accSubtotal;

  // Promotions par produit
  let runningSubtotal = 0;
  for (const item of input.productItems) {
    let itemPriceWithPromo = Number(item.total_price) || 0;
    const productPromos = input.promotions.filter((p) => p.scope === 'PRODUCT' && p.product_id === item.product_id);

    for (const promo of productPromos) {
      if (promo.promo_mode === 'BUY_X_GET_Y') {
        const y = promo.required_qty || 1;
        const x = promo.free_qty || 0;
        const setSize = y + x;
        const quantity = item.quantity || 0;

        let freeUnits = 0;
        if (promo.is_cumulative !== false) {
          freeUnits = Math.floor(quantity / setSize) * x;
        } else if (quantity >= setSize) {
          freeUnits = x;
        }
        itemPriceWithPromo -= freeUnits * (item.unit_price || 0);
      } else if (promo.type === 'PERCENTAGE') {
        itemPriceWithPromo *= 1 - (promo.value || 0) / 100;
      } else {
        itemPriceWithPromo = Math.max(0, itemPriceWithPromo - (promo.value || 0) * (item.quantity || 0));
      }
    }
    runningSubtotal += Math.max(0, itemPriceWithPromo);
  }

  runningSubtotal += accSubtotal;

  // Promotions sur toute la commande
  for (const promo of input.promotions.filter((p) => p.scope === 'ORDER')) {
    if (runningSubtotal >= (promo.min_order_amount || 0)) {
      if (promo.type === 'PERCENTAGE') {
        runningSubtotal *= 1 - (promo.value || 0) / 100;
      } else {
        runningSubtotal = Math.max(0, runningSubtotal - (promo.value || 0));
      }
    }
  }

  const manualDiscount = Number(input.manualDiscount) || 0;
  // Remise totale affichée = remise des promotions + remise manuelle (bornée au montant)
  const promoDiscountAmount = subtotal - runningSubtotal;
  const appliedManualDiscount = Math.min(manualDiscount, Math.max(0, runningSubtotal));
  const totalDiscount = promoDiscountAmount + appliedManualDiscount;

  // TVA selon le régime du point (prix TTC : extraite ; prix HT : ajoutée).
  // Base taxable : ventes nettes de remises + frais d'emballage et de livraison.
  // Le pourboire n'est pas une recette taxable : il s'ajoute après la TVA.
  const taxable =
    Math.max(0, runningSubtotal - manualDiscount) + (Number(input.takeawayFee) || 0) + (Number(input.deliveryFee) || 0);
  const { tax, total: taxedTotal } = computeTax(taxable, input.taxSettings);

  return { subtotal, discount: totalDiscount, tax, total: taxedTotal + (Number(input.tip) || 0) };
}

/**
 * Remise manuelle saisie en caisse. Elle a sa propre colonne (docs/phase14-fixes.sql) :
 * `discount_amount` contient la remise totale (promotions + remise manuelle) et ne
 * doit jamais être relu comme remise manuelle, sinon la remise promo est déduite
 * une deuxième fois à chaque recalcul.
 */
function manualDiscountOf(order: Record<string, any>) {
  if ('manual_discount' in order) return Number(order.manual_discount) || 0;
  // Avant la migration : ancien comportement (à corriger en exécutant phase14).
  return Number(order.discount_amount) || 0;
}

/** Recalcule et enregistre le total d'une commande existante. */
export async function recomputeOrderTotal(orderId: string) {
  const admin = getAdminSupabase();

  const [{ data: productItems }, { data: accChoices }, { data: order }] = await Promise.all([
    admin
      .from('order_items')
      .select('product_id, unit_price, total_price, is_price_counted, quantity')
      .eq('order_id', orderId)
      .is('parent_order_item_id', null),
    admin.from('order_accompaniments').select('total_price_snapshot, is_price_counted').eq('order_id', orderId),
    // * : tolère les colonnes optionnelles (delivery_fee, manual_discount…)
    admin.from('orders').select('*').eq('id', orderId).single(),
  ]);

  if (!order || !productItems) return;

  const taxSettings = await getStructureTaxSettings(order.structure_id);
  const amounts = computeOrderAmounts({
    productItems,
    accompaniments: accChoices || [],
    promotions: await loadActivePromotions(order.structure_id, order.promotion_id),
    taxSettings,
    manualDiscount: manualDiscountOf(order),
    tip: order.tip_amount,
    takeawayFee: order.takeaway_fee,
    deliveryFee: order.delivery_fee,
  });

  await admin
    .from('orders')
    .update({ subtotal: amounts.subtotal, discount_amount: amounts.discount, tax: amounts.tax, total: amounts.total })
    .eq('id', orderId);

  await saveTaxSnapshot('orders', orderId, taxSettings);
}
