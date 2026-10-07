'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { notifyStructureStaff, notifyUser } from '@/lib/notifications';
import { validatePromoCode, recordPromoUsage } from './promotions';
import { getActiveShift, getStructureActiveShift } from './shifts';
import { postSaleSafely } from '@/lib/accounting/posting';
import { recomputeOrderTotal } from '@/lib/order-totals';
import { syncOrderWebhook } from '@/lib/api/webhooks';
import { resolveDelivery } from '@/lib/delivery';
import { undeliverableProducts } from '@/lib/categories';

type ProductAccompanimentMapping = {
  product_id: string;
  accompaniment_product_id: string;
  quantity: number;
  price_included: boolean;
};

type ParentOrderItem = {
  id: string;
  product_id: string;
  quantity: number;
};

export async function createOrder(
  tableNumber: number | null,
  notes: string | null
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'CAISSE', 'SERVEUR', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: await te('errors.registerClosed') };
  }

  try {
    const admin = getAdminSupabase();

    const { data: order, error } = await admin
      .from('orders')
      .insert({
        structure_id: session.structureId,
        user_id: session.userId,
        table_number: tableNumber,
        status: 'PENDING',
        notes: notes || null,
        subtotal: 0,
        total: 0,
      })
      .select()
      .single();

    if (error || !order) {
      return { success: false, error: await te('errors.orderCreateFailed') };
    }

    await notifyStructureStaff({
      structureId: session.structureId as string,
      message: ({ t }) => ({
        title: t('notify.newOrder.title'),
        body: t('notify.newOrder.body', { ref: order.id.slice(0, 8) }),
      }),
      url: `/orders/${order.id}`,
      roles: ['ADMIN', 'CAISSE', 'SERVEUR', 'SUPER_ADMIN'],
    });

    return { success: true, orderId: order.id };
  } catch (error) {
    console.error('Create order error:', error);
    return { success: false, error: await te('errors.orderCreateFailed') };
  }
}

export async function createOrderWithItems(
  _prevState: { success: boolean; error: string; orderId?: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'CAISSE', 'SERVEUR', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: await te('errors.registerClosed') };
  }

  const tableNumberRaw = String(formData.get('tableNumber') || '').trim();
  const roomId = String(formData.get('roomId') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const notesRaw = String(formData.get('notes') || '').trim();
  const itemsRaw = String(formData.get('items') || '');
  const promoCode = String(formData.get('promoCode') || '').trim();
  const promotionId = String(formData.get('promotionId') || '').trim();
  
  // Nouveaux champs Phase 2
  const clientId = String(formData.get('clientId') || '').trim();
  const tableId = String(formData.get('tableId') || '').trim();
  const tipAmount = Number(formData.get('tipAmount')) || 0;
  const discountAmount = Number(formData.get('discountAmount')) || 0;
  const discountReason = String(formData.get('discountReason') || '').trim();

  type ClientSelectedAccompaniment = { accompanimentId: string; priceCounted: boolean };
  type ClientOrderItem = {
    productId: string;
    quantity: number;
    accompaniments?: ClientSelectedAccompaniment[];
  };

  let parsedItems: ClientOrderItem[] = [];
  try {
    const json = JSON.parse(itemsRaw);
    if (Array.isArray(json)) {
      parsedItems = json;
    }
  } catch {
    return { success: false, error: await te('errors.invalidOrderItems') };
  }

  const normalizedItems = parsedItems
    .map((item) => {
      const productId = String((item as any).productId || '').trim();
      const quantity = Number((item as any).quantity || 0);
      const accompaniments = Array.isArray((item as any).accompaniments)
        ? ((item as any).accompaniments as any[]).map((a) => ({
            accompanimentId: String(a.accompanimentId || '').trim(),
            priceCounted: a.priceCounted === undefined ? true : Boolean(a.priceCounted),
          }))
        : [];

      return { productId, quantity, accompaniments };
    })
    .filter(
      (item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0
    );

  if (normalizedItems.length === 0) {
    return { success: false, error: await te('errors.addAtLeastOneProduct') };
  }
  
  if (!phone) {
    return { success: false, error: await te('errors.phoneRequired') };
  }

  // Consolidate quantities per product_id + merge accompaniment choices.
  const consolidatedMap = new Map<
    string,
    { quantity: number; accompaniments: Map<string, boolean> }
  >();

  for (const item of normalizedItems) {
    let entry = consolidatedMap.get(item.productId);
    if (!entry) {
      entry = { quantity: 0, accompaniments: new Map() };
      consolidatedMap.set(item.productId, entry);
    }

    entry.quantity += item.quantity;

    for (const selectedAcc of item.accompaniments) {
      if (!selectedAcc.accompanimentId) continue;
      const prev = entry.accompaniments.get(selectedAcc.accompanimentId);
      entry.accompaniments.set(
        selectedAcc.accompanimentId,
        prev === undefined ? selectedAcc.priceCounted : prev || selectedAcc.priceCounted
      );
    }
  }

  const consolidatedItems = Array.from(consolidatedMap.entries()).map(
    ([productId, v]) => ({
      productId,
      quantity: v.quantity,
      accompaniments: Array.from(v.accompaniments.entries()).map(([accompanimentId, priceCounted]) => ({
        accompanimentId,
        priceCounted,
      })),
    })
  );

  const uniqueProductIds = Array.from(consolidatedMap.keys());
  const tableNumber = tableNumberRaw ? Number(tableNumberRaw) : null;
  const notes = notesRaw || null;

  try {
    const admin = getAdminSupabase();

    const { data: products, error: productsError } = await admin
      .from('products')
      .select('id, price, is_available, is_deleted')
      .in('id', uniqueProductIds)
      .eq('structure_id', session.structureId);

    if (productsError || !products) {
      return { success: false, error: await te('errors.productsValidationFailed') };
    }

    const validProducts = new Map(
      products
        .filter((p) => p.is_available && !p.is_deleted)
        .map((p) => [p.id, Number(p.price)])
    );

    if (validProducts.size !== uniqueProductIds.length) {
      return { success: false, error: await te('errors.productsUnavailable') };
    }

    let verifiedPromo = null;
    if (promoCode) {
      const validation = await validatePromoCode(promoCode, session.structureId as string, session.userId);
      if (!validation.valid) {
        return { success: false, error: validation.error || await te('errors.invalidPromoCode') };
      }
      verifiedPromo = validation;
    } else if (promotionId) {
      // Manual selection from POS
      verifiedPromo = { promotionId };
    }

    // Commande à livrer : zone, frais et adresse vérifiés côté serveur.
    let deliveryFields = {};
    if (formData.get('isDelivery') === 'true') {
      const delivery = await resolveDelivery(session.structureId as string, {
        zoneId: String(formData.get('deliveryZoneId') || ''),
        district: String(formData.get('deliveryDistrict') || ''),
        landmark: String(formData.get('deliveryLandmark') || ''),
        phone,
      });
      if ('error' in delivery) return { success: false, error: delivery.error };
      deliveryFields = delivery.fields;

      const blocked = await undeliverableProducts(session.structureId as string, uniqueProductIds);
      if (blocked.length) return { success: false, error: await te('errors.productsNotDeliverable', { names: blocked.join(', ') }) };
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        structure_id: session.structureId,
        user_id: session.userId,
        table_number: tableNumber,
        room_id: roomId || null,
        phone: phone || null,
        status: 'PENDING',
        notes,
        subtotal: 0,
        total: 0,
        promotion_id: verifiedPromo?.promotionId || null,
        client_id: clientId || null,
        table_id: tableId || null,
        tip_amount: tipAmount,
        discount_amount: discountAmount,
        discount_reason: discountReason || null,
        ...deliveryFields,
      })
      .select()
      .single();

    if (orderError || !order) {
      return { success: false, error: await te('errors.orderCreateFailed') };
    }

    const createdOrderId = order.id as string;

    // Remise manuelle dans sa propre colonne (docs/phase14-fixes.sql) : discount_amount
    // sera ensuite réécrit avec la remise totale (promotions + manuelle).
    if (discountAmount > 0) {
      const { error: manualError } = await admin
        .from('orders')
        .update({ manual_discount: discountAmount })
        .eq('id', createdOrderId);
      if (manualError) console.warn('[orders] remise manuelle non enregistrée (phase14 à exécuter) :', manualError.message);
    }

    const parentOrderItemsToInsert = consolidatedItems.map((item) => {
      const unitPrice = validProducts.get(item.productId) || 0;
      return {
        order_id: createdOrderId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: unitPrice * item.quantity,
        is_price_counted: true,
        parent_order_item_id: null,
      };
    });

    const { data: insertedParentOrderItems, error: itemsError } = await admin
      .from('order_items')
      .insert(parentOrderItemsToInsert)
      .select('id, product_id, quantity');

    if (itemsError || !insertedParentOrderItems) {
      await admin
        .from('orders')
        .delete()
        .eq('id', createdOrderId)
        .eq('structure_id', session.structureId);
      return { success: false, error: await te('errors.orderItemsSaveFailed') };
    }

    const parentItemByProductId = new Map<string, { id: string; quantity: number }>(
      (insertedParentOrderItems as Array<any>).map((row: any) => [
        row.product_id as string,
        { id: row.id as string, quantity: Number(row.quantity) },
      ])
    );

    // Insert accompaniments choices (with price counted toggle).
    const selectedAccompIds = Array.from(
      new Set(
        consolidatedItems.flatMap((it) => it.accompaniments.map((a) => a.accompanimentId))
      )
    ).filter(Boolean);

    if (selectedAccompIds.length > 0) {
      const selectedAccompByProduct = new Map<
        string,
        Array<{ accompanimentId: string; priceCounted: boolean }>
      >();
      for (const it of consolidatedItems) {
        if (!it.accompaniments?.length) continue;
        selectedAccompByProduct.set(it.productId, it.accompaniments);
      }

      const { data: mappings, error: mappingsError } = await admin
        .from('product_accompaniments')
        .select('product_id, accompaniment_id, quantity')
        .in('product_id', uniqueProductIds)
        .in('accompaniment_id', selectedAccompIds)
        .eq('structure_id', session.structureId);

      if (mappingsError || !mappings) {
        await admin
          .from('orders')
          .delete()
          .eq('id', createdOrderId)
          .eq('structure_id', session.structureId);
        return { success: false, error: await te('errors.accompanimentMappingsFailed') };
      }

      const mappingMultiplierByKey = new Map<string, number>(
        (mappings as any[]).map((m) => [
          `${m.product_id}:${m.accompaniment_id}`,
          Number(m.quantity || 1),
        ])
      );

      // Vérifie que toutes les sélections envoyées sont bien configurées pour le produit.
      for (const it of consolidatedItems) {
        const parentId = it.productId;
        const selectedForProduct = selectedAccompByProduct.get(parentId) || [];
        for (const sel of selectedForProduct) {
          const key = `${parentId}:${sel.accompanimentId}`;
          if (!mappingMultiplierByKey.has(key)) {
            await admin
              .from('orders')
              .delete()
              .eq('id', createdOrderId)
              .eq('structure_id', session.structureId);
            return {
              success: false,
              error: await te('errors.accompanimentsNotConfigured'),
            };
          }
        }
      }

      const { data: accRows, error: accError } = await admin
        .from('accompaniments')
        .select('id, price, is_available, is_deleted')
        .in('id', selectedAccompIds)
        .eq('structure_id', session.structureId);

      if (accError || !accRows) {
        await admin
          .from('orders')
          .delete()
          .eq('id', createdOrderId)
          .eq('structure_id', session.structureId);
        return { success: false, error: await te('errors.accompanimentsValidationFailed') };
      }

      const accMap = new Map<string, { price: number }>(
        (accRows as any[])
          .filter((a) => a.is_available && !a.is_deleted)
          .map((a) => [a.id as string, { price: Number(a.price) }])
      );

      for (const selectedId of selectedAccompIds) {
        if (!accMap.has(selectedId)) {
          await admin
            .from('orders')
            .delete()
            .eq('id', createdOrderId)
            .eq('structure_id', session.structureId);
          return { success: false, error: await te('errors.accompanimentsUnavailable') };
        }
      }

      const orderAccompRows: Array<{
        order_id: string;
        parent_order_item_id: string;
        accompaniment_id: string;
        quantity: number;
        unit_price_snapshot: number;
        total_price_snapshot: number;
        is_price_counted: boolean;
      }> = [];

      for (const it of consolidatedItems) {
        const parent = parentItemByProductId.get(it.productId);
        if (!parent) continue;

        const selectedForProduct = selectedAccompByProduct.get(it.productId) || [];
        for (const sel of selectedForProduct) {
          const unitPrice = accMap.get(sel.accompanimentId)?.price;
          const multiplier = mappingMultiplierByKey.get(`${it.productId}:${sel.accompanimentId}`);
          if (unitPrice === undefined || multiplier === undefined) continue;

          const quantity = parent.quantity * multiplier;
          orderAccompRows.push({
            order_id: createdOrderId,
            parent_order_item_id: parent.id,
            accompaniment_id: sel.accompanimentId,
            quantity,
            unit_price_snapshot: unitPrice,
            total_price_snapshot: unitPrice * quantity,
            is_price_counted: sel.priceCounted,
          });
        }
      }

      if (orderAccompRows.length > 0) {
        const { error: accInsertErr } = await admin
          .from('order_accompaniments')
          .insert(orderAccompRows);

        if (accInsertErr) {
          await admin
            .from('orders')
            .delete()
            .eq('id', createdOrderId)
            .eq('structure_id', session.structureId);
          return { success: false, error: await te('errors.orderAccompanimentsSaveFailed') };
        }
      }
    }

    await recomputeOrderTotal(createdOrderId);

    if (verifiedPromo) {
      await recordPromoUsage(verifiedPromo.promotionId as string, session.userId);
    }

    await notifyStructureStaff({
      structureId: session.structureId as string,
      message: ({ t }) => ({
        title: t('notify.newOrder.title'),
        body: t('notify.newOrder.body', { ref: createdOrderId.slice(0, 8) }),
      }),
      url: `/orders/${createdOrderId}`,
      roles: ['ADMIN', 'CAISSE', 'SERVEUR', 'SUPER_ADMIN'],
    });

    return { success: true, orderId: createdOrderId, error: '' };
  } catch (error) {
    console.error('Create order with items error:', error);
    return { success: false, error: await te('errors.orderCreateFailed') };
  }
}

export async function addOrderItem(
  orderId: string,
  productId: string,
  quantity: number,
  unitPrice: number
) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: await te('errors.unauthorized') };
  }
  
  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: await te('errors.registerClosedItems') };
  }

  try {
    const admin = getAdminSupabase();

    // Commande et produit du point connecté ; le prix vient du catalogue, pas du navigateur.
    const [{ data: order }, { data: product }] = await Promise.all([
      admin.from('orders').select('id, consumption_type').eq('id', orderId).eq('structure_id', session.structureId).maybeSingle(),
      admin
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('structure_id', session.structureId)
        .eq('is_deleted', false)
        .maybeSingle(),
    ]);
    if (!order || !product || !product.is_available) {
      return { success: false, error: await te('errors.productsUnavailable') };
    }
    if (order.consumption_type === 'DELIVERY' && product.is_deliverable === false) {
      return { success: false, error: await te('errors.productsNotDeliverable', { names: product.name }) };
    }
    unitPrice = Number(product.price) || 0;

    const totalPrice = quantity * unitPrice;

    const { data: item, error } = await admin
      .from('order_items')
      .insert({
        order_id: orderId,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        is_price_counted: true,
        parent_order_item_id: null,
      })
      .select()
      .single();

    if (error || !item) {
      return { success: false, error: await te('errors.itemAddFailed') };
    }

    // Update order totals (respecting price_included)
    await recomputeOrderTotal(orderId);

    return { success: true };
  } catch (error) {
    console.error('Add order item error:', error);
    return { success: false, error: await te('errors.itemAddFailed') };
  }
}

export async function getOrderAccompanimentChoices(orderId: string) {
  const session = await getSession();
  if (!session) return { parents: [] as Array<any> };

  const admin = getAdminSupabase();

  // Verify order exists and belongs to this structure.
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('structure_id', session.structureId)
    .single();

  if (orderError || !order) return { parents: [] as Array<any> };

  // Parent product order lines.
  const { data: parentItems } = await admin
    .from('order_items')
    .select('id, product_id, quantity')
    .eq('order_id', orderId)
    .is('parent_order_item_id', null);

  const parentItemsList = (parentItems || []) as Array<{
    id: string;
    product_id: string;
    quantity: number;
  }>;

  if (!parentItemsList.length) return { parents: [] as Array<any> };

  const parentProductIds = Array.from(new Set(parentItemsList.map((p) => p.product_id)));

  // Mapping product -> accompaniments.
  const { data: mappings, error: mappingsError } = await admin
    .from('product_accompaniments')
    .select('product_id, accompaniment_id, quantity')
    .in('product_id', parentProductIds)
    .eq('structure_id', session.structureId);

  if (mappingsError) return { parents: [] as Array<any> };

  const mappingsList = (mappings || []) as Array<{
    product_id: string;
    accompaniment_id: string;
    quantity: number;
  }>;

  const accompanimentIds = Array.from(new Set(mappingsList.map((m) => m.accompaniment_id)));
  const { data: accompRows } = await admin
    .from('accompaniments')
    .select('id, name, price, is_available, is_deleted')
    .in('id', accompanimentIds)
    .eq('structure_id', session.structureId);

  const accMap = new Map<string, { name: string; price: number }>(
    (accompRows || [])
      .filter((p: any) => p.is_available && !p.is_deleted)
      .map((p: any) => [p.id as string, { name: p.name as string, price: Number(p.price) }])
  );

  // Existing choices in order.
  const { data: existingChoices } = await admin
    .from('order_accompaniments')
    .select('id, parent_order_item_id, accompaniment_id, is_price_counted')
    .eq('order_id', orderId);

  const existingMap = new Map<string, { choiceId: string; isPriceCounted: boolean }>();
  (existingChoices || []).forEach((it: any) => {
    const key = `${it.parent_order_item_id}:${it.accompaniment_id}`;
    existingMap.set(key, {
      choiceId: it.id as string,
      isPriceCounted: Boolean(it.is_price_counted ?? true),
    });
  });

  const parents = parentItemsList.map((parent) => {
    const parentMappings = mappingsList.filter((m) => m.product_id === parent.product_id);

    const possibleAccompaniments = parentMappings
      .map((m) => {
        const acc = accMap.get(m.accompaniment_id);
        if (!acc) return null;
        const key = `${parent.id}:${m.accompaniment_id}`;
        const existing = existingMap.get(key);

        return {
          // garder les noms utilisés par l'UI existante
          accompanimentProductId: m.accompaniment_id,
          name: acc.name,
          unitPrice: acc.price,
          quantityMultiplier: Number(m.quantity || 1),
          defaultPriceIncluded: true,
          existingOrderItemId: existing?.choiceId ?? null,
          existingIsPriceCounted: existing?.isPriceCounted ?? null,
        };
      })
      .filter(Boolean);

    return {
      parentOrderItemId: parent.id,
      parentProductId: parent.product_id,
      possibleAccompaniments,
    };
  });

  return { parents };
}

export async function addOrderAccompaniment(
  orderId: string,
  parentOrderItemId: string,
  accompanimentProductId: string,
  priceCounted: boolean
) {
  const session = await getSession();
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  const admin = getAdminSupabase();

  // Verify order exists.
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('structure_id', session.structureId)
    .single();

  if (orderError || !order) return { success: false, error: await te('errors.orderNotFound') };

  // Parent order item (product line).
  const { data: parentItem, error: parentError } = await admin
    .from('order_items')
    .select('id, product_id, quantity, parent_order_item_id')
    .eq('id', parentOrderItemId)
    .eq('order_id', orderId)
    .single();

  if (parentError || !parentItem || parentItem.parent_order_item_id) {
    return { success: false, error: await te('errors.parentItemNotFound') };
  }

  // Mapping product -> accompaniment
  const { data: mapping, error: mappingError } = await admin
    .from('product_accompaniments')
    .select('quantity')
    .eq('structure_id', session.structureId)
    .eq('product_id', parentItem.product_id)
    .eq('accompaniment_id', accompanimentProductId)
    .single();

  if (mappingError || !mapping) {
    return { success: false, error: await te('errors.accompanimentNotConfigured') };
  }

  // Accompaniment price snapshot
  const { data: acc, error: accError } = await admin
    .from('accompaniments')
    .select('id, price, is_available, is_deleted')
    .eq('id', accompanimentProductId)
    .eq('structure_id', session.structureId)
    .single();

  if (accError || !acc || !acc.is_available || acc.is_deleted) {
    return { success: false, error: await te('errors.accompanimentUnavailable') };
  }

  const unitPrice = Number(acc.price);
  const quantityMultiplier = Number(mapping.quantity || 1);
  const quantity = parentItem.quantity * quantityMultiplier;
  const totalPrice = unitPrice * quantity;

  // Upsert order_accompaniments row for this choice.
  const { data: existing } = await admin
    .from('order_accompaniments')
    .select('id')
    .eq('order_id', orderId)
    .eq('parent_order_item_id', parentOrderItemId)
    .eq('accompaniment_id', accompanimentProductId)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateErr } = await admin
      .from('order_accompaniments')
      .update({
        quantity,
        unit_price_snapshot: unitPrice,
        total_price_snapshot: totalPrice,
        is_price_counted: priceCounted,
      })
      .eq('id', existing.id);

    if (updateErr) return { success: false, error: await te('errors.accompanimentUpdateFailed') };
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from('order_accompaniments')
      .insert({
        order_id: orderId,
        parent_order_item_id: parentOrderItemId,
        accompaniment_id: accompanimentProductId,
        quantity,
        unit_price_snapshot: unitPrice,
        total_price_snapshot: totalPrice,
        is_price_counted: priceCounted,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) return { success: false, error: await te('errors.accompanimentAddFailed') };
  }

  await recomputeOrderTotal(orderId);
  return { success: true };
}

export async function setOrderItemPriceCounted(itemId: string, priceCounted: boolean) {
  const session = await getSession();
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  const admin = getAdminSupabase();

  // itemId correspond à la ligne `order_accompaniments`.
  const { data: item, error: itemError } = await admin
    .from('order_accompaniments')
    .select('id, order_id')
    .eq('id', itemId)
    .single();

  if (itemError || !item) return { success: false, error: await te('errors.itemNotFound') };

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id')
    .eq('id', item.order_id)
    .eq('structure_id', session.structureId)
    .single();

  if (orderError || !order) return { success: false, error: await te('errors.orderNotFound') };

  const { error: updateErr } = await admin
    .from('order_accompaniments')
    .update({ is_price_counted: priceCounted })
    .eq('id', itemId);

  if (updateErr) return { success: false, error: await te('errors.priceFlagFailed') };

  await recomputeOrderTotal(item.order_id);
  return { success: true };
}

import { processOrderStock } from './stock';
import { te } from '@/lib/i18n/server';

export async function updateOrderStatus(
  orderId: string,
  status: string
) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: await te('errors.registerClosedOrder') };
  }

  // ROLE ENFORCEMENT: Server cannot validate (COMPLETED) or cancel
  if (session.role === 'SERVEUR' && ['COMPLETED', 'CANCELLED'].includes(status)) {
    return { success: false, error: await te('errors.cashierOnly') };
  }

  // General unauthorized check for non-management
  if (!['ADMIN', 'CAISSE', 'SUPER_ADMIN', 'SERVEUR'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();

    const updatePayload: Record<string, any> = { status };
    if (status === 'COMPLETED') {
      updatePayload.paid_at = new Date().toISOString();
    }

    const { error } = await admin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: await te('errors.orderUpdateFailed') };
    }

    // REDUIRE LE STOCK SI COMMANDE TERMINEE
    if (status === 'COMPLETED') {
      await processOrderStock(orderId);
      await postSaleSafely('ORDER', orderId);
    }

    // Commande marketplace : la marketplace est prévenue du nouveau statut.
    await syncOrderWebhook(orderId);

    // Notify client if applicable
    const { data: order } = await admin.from('orders').select('client_id, user_id').eq('id', orderId).single();
    const targetUserId = order?.client_id || order?.user_id;
    if (targetUserId) {
      await notifyUser({
        userId: targetUserId,
        structureId: session.structureId!,
        message: ({ t }) => ({
          title: t('notify.orderUpdated.title'),
          body: t('notify.orderUpdated.body', {
            ref: orderId.slice(0, 8),
            status: t(`orders.status.${status as 'PENDING'}`),
          }),
        }),
        url: `/history`,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Update order status error:', error);
    return { success: false, error: await te('errors.orderUpdateFailed') };
  }
}

export async function removeOrderItem(itemId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();

    // Get the order_id to update totals
    const { data: item } = await admin
      .from('order_items')
      .select('order_id')
      .eq('id', itemId)
      .single();

    const { error } = await admin
      .from('order_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      return { success: false, error: await te('errors.itemRemoveFailed') };
    }

    if (item) {
      await recomputeOrderTotal(item.order_id);
    }

    return { success: true };
  } catch (error) {
    console.error('Remove order item error:', error);
    return { success: false, error: await te('errors.itemRemoveFailed') };
  }
}

export async function removeOrderAccompaniment(orderAccompanimentId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();

    const { data: existing, error: existingErr } = await admin
      .from('order_accompaniments')
      .select('id, order_id')
      .eq('id', orderAccompanimentId)
      .single();

    if (existingErr || !existing) {
      return { success: false, error: await te('errors.accompanimentChoiceNotFound') };
    }

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id')
      .eq('id', existing.order_id)
      .eq('structure_id', session.structureId)
      .single();

    if (orderErr || !order) {
      return { success: false, error: await te('errors.orderNotFound') };
    }

    const { error: deleteErr } = await admin
      .from('order_accompaniments')
      .delete()
      .eq('id', orderAccompanimentId);

    if (deleteErr) {
      return { success: false, error: await te('errors.accompanimentRemoveFailed') };
    }

    await recomputeOrderTotal(existing.order_id);
    return { success: true };
  } catch (error) {
    console.error('Remove order accompaniment error:', error);
    return { success: false, error: await te('errors.itemRemoveFailed') };
  }
}

export async function getOrder(orderId: string) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const admin = getAdminSupabase();

    const { data: order } = await admin
      .from('orders')
      .select('*, structures(*), rooms(number), tables(name, floor_name), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
      .eq('id', orderId)
      .eq('structure_id', session.structureId)
      .single();

    return order;
  } catch (error) {
    return null;
  }
}

export async function getOrders(
  structureId: string,
  status?: string,
  limit: number = 50
) {
  try {
    const admin = getAdminSupabase();

    let query = admin
      .from('orders')
      .select('*, structures(*), rooms(number), tables(name, floor_name), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
      .eq('structure_id', structureId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('[getOrders] Error:', error);
      return [];
    }

    return orders || [];
  } catch (error) {
    console.error('[getOrders] Exception:', error);
    return [];
  }
}

export async function getAvailableProducts() {
  const session = await getSession();
  if (!session) {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('products')
      .select('*')
      .eq('structure_id', session.structureId)
      .eq('is_available', true)
      .eq('is_deleted', false)
      .order('name', { ascending: true });

    return data || [];
  } catch (error) {
    return [];
  }
}
