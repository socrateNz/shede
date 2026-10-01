import { getAdminSupabase } from '@/lib/supabase';
import { computeTax } from '@/lib/tax';
import { getStructureTaxSettings, saveTaxSnapshot } from '@/lib/fiscal';

// Recalcul du total d'une commande — module serveur, PAS une Server Action :
// il ne doit pas pouvoir être appelé depuis le navigateur. Les appelants
// (caisse, app client, API) vérifient eux-mêmes les droits sur la commande.

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

export async function recomputeOrderTotal(orderId: string) {
  const admin = getAdminSupabase();

  // 1. Lignes produits (lignes parent uniquement)
  const { data: productItems } = await admin
    .from('order_items')
    .select('product_id, unit_price, total_price, is_price_counted, quantity')
    .eq('order_id', orderId)
    .is('parent_order_item_id', null);

  const productSubtotal =
    productItems?.reduce((sum, item) => {
      const counted = item.is_price_counted ?? true;
      return sum + (counted ? item.total_price : 0);
    }, 0) || 0;

  // 2. Accompagnements choisis
  const { data: accChoices } = await admin
    .from('order_accompaniments')
    .select('total_price_snapshot, is_price_counted')
    .eq('order_id', orderId);

  const accSubtotal =
    accChoices?.reduce((sum, item) => {
      const counted = item.is_price_counted ?? true;
      return sum + (counted ? item.total_price_snapshot : 0);
    }, 0) || 0;

  const subtotal = productSubtotal + accSubtotal;

  // 3. Promotions, remise manuelle, pourboire
  const { data: order } = await admin
    .from('orders')
    // * : tolère les colonnes optionnelles (delivery_fee, manual_discount…)
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order || !productItems) return;

  const now = new Date().toISOString();

  // A. Promotions automatiques actives (STANDARD et BUY_X_GET_Y)
  const { data: autoPromos } = await admin
    .from('promotions')
    .select('*')
    .eq('structure_id', order.structure_id)
    .eq('is_active', true)
    .in('promo_mode', ['STANDARD', 'BUY_X_GET_Y'])
    .lte('start_date', now)
    .gte('end_date', now);

  const promosToApply = [...(autoPromos || [])];

  // B. Code promo rattaché à la commande
  if (order.promotion_id) {
    const { data: selectedPromo } = await admin
      .from('promotions')
      .select('*')
      .eq('id', order.promotion_id)
      .single();

    if (selectedPromo && selectedPromo.is_active && selectedPromo.promo_mode === 'CODE') {
      const current = new Date();
      if (current >= new Date(selectedPromo.start_date) && current <= new Date(selectedPromo.end_date)) {
        promosToApply.push(selectedPromo);
      }
    }
  }

  // C. Application en cascade
  let runningSubtotal = 0;

  // Promotions par produit
  for (const item of productItems) {
    let itemPriceWithPromo = item.total_price || 0;
    const productPromos = promosToApply.filter((p) => p.scope === 'PRODUCT' && p.product_id === item.product_id);

    for (const promo of productPromos) {
      if (promo.promo_mode === 'BUY_X_GET_Y') {
        const y = promo.required_qty || 1;
        const x = promo.free_qty || 0;
        const setSize = y + x;
        const quantity = item.quantity || 0;

        let freeUnits = 0;
        const isCumulative = promo.is_cumulative !== false;
        if (isCumulative) {
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
  for (const promo of promosToApply.filter((p) => p.scope === 'ORDER')) {
    if (runningSubtotal >= (promo.min_order_amount || 0)) {
      if (promo.type === 'PERCENTAGE') {
        runningSubtotal *= 1 - (promo.value || 0) / 100;
      } else {
        runningSubtotal = Math.max(0, runningSubtotal - (promo.value || 0));
      }
    }
  }

  const manualDiscount = manualDiscountOf(order);
  const tipAmount = Number(order.tip_amount) || 0;
  const takeawayFee = Number(order.takeaway_fee) || 0;
  const deliveryFee = Number(order.delivery_fee) || 0;

  // Remise totale affichée = remise des promotions + remise manuelle (bornée au montant)
  const promoDiscountAmount = subtotal - runningSubtotal;
  const appliedManualDiscount = Math.min(manualDiscount, Math.max(0, runningSubtotal));
  const totalDiscount = promoDiscountAmount + appliedManualDiscount;

  // TVA selon le régime du point (prix TTC : extraite ; prix HT : ajoutée).
  // Base taxable : ventes nettes de remises + frais d'emballage et de livraison.
  // Le pourboire n'est pas une recette taxable : il s'ajoute après la TVA.
  const taxSettings = await getStructureTaxSettings(order.structure_id);
  const taxable = Math.max(0, runningSubtotal - manualDiscount) + takeawayFee + deliveryFee;
  const { tax, total: taxedTotal } = computeTax(taxable, taxSettings);
  const finalTotal = taxedTotal + tipAmount;

  await admin
    .from('orders')
    .update({
      subtotal,
      discount_amount: totalDiscount,
      tax,
      total: finalTotal,
    })
    .eq('id', orderId);

  await saveTaxSnapshot('orders', orderId, taxSettings);
}
