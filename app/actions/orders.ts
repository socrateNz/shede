'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { notifyStructureStaff, notifyUser } from '@/app/actions/push';
import { validatePromoCode, recordPromoUsage } from './promotions';
import { getActiveShift, getStructureActiveShift } from './shifts';

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
    return { success: false, error: 'Unauthorized' };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: 'La caisse doit être ouverte pour effectuer cette opération.' };
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
      return { success: false, error: 'Failed to create order' };
    }

    await notifyStructureStaff({
      structureId: session.structureId as string,
      title: 'Nouvelle commande',
      body: `Commande ${order.id.slice(0, 8)} creee`,
      url: `/orders/${order.id}`,
    });

    return { success: true, orderId: order.id };
  } catch (error) {
    console.error('Create order error:', error);
    return { success: false, error: 'Failed to create order' };
  }
}

export async function createOrderWithItems(
  _prevState: { success: boolean; error: string; orderId?: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'CAISSE', 'SERVEUR', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: 'La caisse doit être ouverte pour effectuer cette opération.' };
  }

  const tableNumberRaw = String(formData.get('tableNumber') || '').trim();
  const roomId = String(formData.get('roomId') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const notesRaw = String(formData.get('notes') || '').trim();
  const itemsRaw = String(formData.get('items') || '');
  const promoCode = String(formData.get('promoCode') || '').trim();
  const promotionId = String(formData.get('promotionId') || '').trim();

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
    return { success: false, error: 'Invalid order items format' };
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
    return { success: false, error: 'Please add at least one product' };
  }
  
  if (!phone) {
    return { success: false, error: 'Phone number is required' };
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
      return { success: false, error: 'Failed to validate products' };
    }

    const validProducts = new Map(
      products
        .filter((p) => p.is_available && !p.is_deleted)
        .map((p) => [p.id, Number(p.price)])
    );

    if (validProducts.size !== uniqueProductIds.length) {
      return { success: false, error: 'One or more products are invalid or unavailable' };
    }

    let verifiedPromo = null;
    if (promoCode) {
      const validation = await validatePromoCode(promoCode, session.structureId as string, session.userId);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Invalid promo code' };
      }
      verifiedPromo = validation;
    } else if (promotionId) {
      // Manual selection from POS
      verifiedPromo = { promotionId };
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
      })
      .select()
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Failed to create order' };
    }

    const createdOrderId = order.id as string;

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
      return { success: false, error: 'Failed to save order items' };
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
        return { success: false, error: 'Failed to validate accompaniment mappings' };
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
              error: 'One or more accompaniments are not configured for selected products',
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
        return { success: false, error: 'Failed to validate accompaniments' };
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
          return { success: false, error: 'One or more accompaniments are invalid/unavailable' };
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
          return { success: false, error: 'Failed to save order accompaniments' };
        }
      }
    }

    await updateOrderTotal(createdOrderId);

    if (verifiedPromo) {
      await recordPromoUsage(verifiedPromo.promotionId as string, session.userId);
    }

    await notifyStructureStaff({
      structureId: session.structureId as string,
      title: 'Nouvelle commande',
      body: `Commande ${createdOrderId.slice(0, 8)} creee`,
      url: `/orders/${createdOrderId}`,
    });

    return { success: true, orderId: createdOrderId, error: '' };
  } catch (error) {
    console.error('Create order with items error:', error);
    return { success: false, error: 'Failed to create order' };
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
    return { success: false, error: 'Unauthorized' };
  }
  
  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: 'La caisse doit être ouverte pour ajouter des articles.' };
  }

  try {
    const admin = getAdminSupabase();

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
      return { success: false, error: 'Failed to add item' };
    }

    // Update order totals (respecting price_included)
    await updateOrderTotal(orderId);

    return { success: true };
  } catch (error) {
    console.error('Add order item error:', error);
    return { success: false, error: 'Failed to add item' };
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
  if (!session) return { success: false, error: 'Unauthorized' };

  const admin = getAdminSupabase();

  // Verify order exists.
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('structure_id', session.structureId)
    .single();

  if (orderError || !order) return { success: false, error: 'Order not found' };

  // Parent order item (product line).
  const { data: parentItem, error: parentError } = await admin
    .from('order_items')
    .select('id, product_id, quantity, parent_order_item_id')
    .eq('id', parentOrderItemId)
    .eq('order_id', orderId)
    .single();

  if (parentError || !parentItem || parentItem.parent_order_item_id) {
    return { success: false, error: 'Parent item not found' };
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
    return { success: false, error: 'Accompaniment not configured' };
  }

  // Accompaniment price snapshot
  const { data: acc, error: accError } = await admin
    .from('accompaniments')
    .select('id, price, is_available, is_deleted')
    .eq('id', accompanimentProductId)
    .eq('structure_id', session.structureId)
    .single();

  if (accError || !acc || !acc.is_available || acc.is_deleted) {
    return { success: false, error: 'Accompaniment invalid/unavailable' };
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

    if (updateErr) return { success: false, error: 'Failed to update accompaniment' };
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

    if (insertErr || !inserted) return { success: false, error: 'Failed to add accompaniment' };
  }

  await updateOrderTotal(orderId);
  return { success: true };
}

export async function setOrderItemPriceCounted(itemId: string, priceCounted: boolean) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const admin = getAdminSupabase();

  // itemId correspond à la ligne `order_accompaniments`.
  const { data: item, error: itemError } = await admin
    .from('order_accompaniments')
    .select('id, order_id')
    .eq('id', itemId)
    .single();

  if (itemError || !item) return { success: false, error: 'Item not found' };

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id')
    .eq('id', item.order_id)
    .eq('structure_id', session.structureId)
    .single();

  if (orderError || !order) return { success: false, error: 'Order not found' };

  const { error: updateErr } = await admin
    .from('order_accompaniments')
    .update({ is_price_counted: priceCounted })
    .eq('id', itemId);

  if (updateErr) return { success: false, error: 'Failed to update price flag' };

  await updateOrderTotal(item.order_id);
  return { success: true };
}

export async function updateOrderTotal(orderId: string) {
  const admin = getAdminSupabase();

  // 1. Totals des produits (lignes parent uniquement)
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

  // 2. Totals des accompagnements choisis
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

  // 3. Handle Promotions Logic
  const { data: order } = await admin
    .from('orders')
    .select('structure_id, promotion_id')
    .eq('id', orderId)
    .single();

  if (!order || !productItems) return;

  const now = new Date().toISOString();

  // A. Fetch All Currently Active "STANDARD" and "BUY_X_GET_Y" promos (Auto-applied)
  const { data: autoPromos } = await admin
    .from('promotions')
    .select('*')
    .eq('structure_id', order.structure_id)
    .eq('is_active', true)
    .in('promo_mode', ['STANDARD', 'BUY_X_GET_Y'])
    .lte('start_date', now)
    .gte('end_date', now);

  const promosToApply = [...(autoPromos || [])];

  // B. Fetch the specifically attached "CODE" promo (if any)
  if (order.promotion_id) {
    const { data: selectedPromo } = await admin
      .from('promotions')
      .select('*')
      .eq('id', order.promotion_id)
      .single();

    if (selectedPromo && selectedPromo.is_active && selectedPromo.promo_mode === 'CODE') {
      // Check dates
      const start = new Date(selectedPromo.start_date);
      const end = new Date(selectedPromo.end_date);
      const current = new Date();
      if (current >= start && current <= end) {
        promosToApply.push(selectedPromo);
      }
    }
  }

  // C. Apply Cascading Logic
  let runningSubtotal = 0;
  
  // 1. First Pass: Apply PRODUCT-level promotions per item
  for (const item of productItems) {
    let itemPriceWithPromo = item.total_price || 0;
    const productPromos = promosToApply.filter(p => p.scope === 'PRODUCT' && p.product_id === item.product_id);
    
    for (const promo of productPromos) {
      if (promo.promo_mode === 'BUY_X_GET_Y') {
        const y = promo.required_qty || 1;
        const x = promo.free_qty || 0;
        const setSize = y + x;
        const quantity = item.quantity || 0;
        
        let freeUnits = 0;
        const isCumulative = promo.is_cumulative !== false; // default to true
        if (isCumulative) {
          freeUnits = Math.floor(quantity / setSize) * x;
        } else if (quantity >= setSize) {
          freeUnits = x;
        }
        itemPriceWithPromo -= (freeUnits * (item.unit_price || 0));
      } else {
        // STANDARD or CODE with PRODUCT scope
        if (promo.type === 'PERCENTAGE') {
          itemPriceWithPromo *= (1 - (promo.value || 0) / 100);
        } else {
          itemPriceWithPromo = Math.max(0, itemPriceWithPromo - ((promo.value || 0) * (item.quantity || 0)));
        }
      }
    }
    runningSubtotal += Math.max(0, itemPriceWithPromo);
  }

  // Add accompaniments to the intermediate subtotal (usually they don't get product-level promos)
  runningSubtotal += accSubtotal;

  // 2. Second Pass: Apply ORDER-level promotions to the intermediate subtotal
  const orderPromos = promosToApply.filter(p => p.scope === 'ORDER');
  for (const promo of orderPromos) {
    if (runningSubtotal >= (promo.min_order_amount || 0)) {
      if (promo.type === 'PERCENTAGE') {
        runningSubtotal *= (1 - (promo.value || 0) / 100);
      } else {
        runningSubtotal = Math.max(0, runningSubtotal - (promo.value || 0));
      }
    }
  }

  const discount_amount = subtotal - runningSubtotal;
  const total = Math.round(Math.max(0, runningSubtotal));

  await admin
    .from('orders')
    .update({
      subtotal,
      discount_amount,
      total,
    })
    .eq('id', orderId);
}

import { processOrderStock } from './stock';

export async function updateOrderStatus(
  orderId: string,
  status: string
) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: 'La caisse doit être ouverte pour traiter une commande.' };
  }

  // ROLE ENFORCEMENT: Server cannot validate (COMPLETED) or cancel
  if (session.role === 'SERVEUR' && ['COMPLETED', 'CANCELLED'].includes(status)) {
    return { success: false, error: 'Seuls les administrateurs ou caissiers peuvent effectuer cette opération.' };
  }

  // General unauthorized check for non-management
  if (!['ADMIN', 'CAISSE', 'SUPER_ADMIN', 'SERVEUR'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .eq('structure_id', session.structureId);

    if (error) {
      return { success: false, error: 'Failed to update order' };
    }

    // REDUIRE LE STOCK SI COMMANDE TERMINEE
    if (status === 'COMPLETED') {
      await processOrderStock(orderId);
    }

    // Notify client if applicable
    const { data: order } = await admin.from('orders').select('client_id, user_id').eq('id', orderId).single();
    const targetUserId = order?.client_id || order?.user_id;
    if (targetUserId) {
      await notifyUser({
        userId: targetUserId,
        structureId: session.structureId!,
        title: `Mise à jour de votre commande`,
        body: `Votre commande ${orderId.slice(0, 8)} est maintenant : ${status}`,
        url: `/history`,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Update order status error:', error);
    return { success: false, error: 'Failed to update order' };
  }
}

export async function removeOrderItem(itemId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
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
      return { success: false, error: 'Failed to remove item' };
    }

    if (item) {
      await updateOrderTotal(item.order_id);
    }

    return { success: true };
  } catch (error) {
    console.error('Remove order item error:', error);
    return { success: false, error: 'Failed to remove item' };
  }
}

export async function removeOrderAccompaniment(orderAccompanimentId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();

    const { data: existing, error: existingErr } = await admin
      .from('order_accompaniments')
      .select('id, order_id')
      .eq('id', orderAccompanimentId)
      .single();

    if (existingErr || !existing) {
      return { success: false, error: 'Accompaniment choice not found' };
    }

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id')
      .eq('id', existing.order_id)
      .eq('structure_id', session.structureId)
      .single();

    if (orderErr || !order) {
      return { success: false, error: 'Order not found' };
    }

    const { error: deleteErr } = await admin
      .from('order_accompaniments')
      .delete()
      .eq('id', orderAccompanimentId);

    if (deleteErr) {
      return { success: false, error: 'Failed to remove accompaniment' };
    }

    await updateOrderTotal(existing.order_id);
    return { success: true };
  } catch (error) {
    console.error('Remove order accompaniment error:', error);
    return { success: false, error: 'Failed to remove item' };
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
      .select('*, structures(name), rooms(number), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
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
      .select('*, structures(name), rooms(number), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
      .eq('structure_id', structureId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders } = await query;

    return orders || [];
  } catch (error) {
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
