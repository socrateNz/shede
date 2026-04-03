'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { notifyStructureStaff } from '@/app/actions/push';

export async function createClientOrder(
  structureId: string, 
  items: { id: string, productId: string, name: string, quantity: number, price: number, selectedAccompaniments?: any[] }[],
  options?: { roomId?: string, tableNumber?: string | number, notes?: string, clientId?: string, phone?: string }
) {
  if (!structureId || items.length === 0) {
    return { success: false, error: 'Structure ID and items are required' };
  }
  if (!options?.phone) {
    return { success: false, error: 'Phone number is required' };
  }

  try {
    const admin = getAdminSupabase();

    // 1. Create the order with 'CLIENT' source
    const tableNum = options?.tableNumber ? parseInt(options.tableNumber.toString(), 10) : null;
    const session = await getSession();
    const clientId = session?.userId || options?.clientId || null;
    
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        structure_id: structureId,
        source: 'CLIENT',
        room_id: options?.roomId || null,
        table_number: isNaN(tableNum as number) ? null : tableNum,
        client_id: clientId,
        user_id: clientId, // Also populate user_id for safety
        phone: options?.phone,
        notes: options?.notes || null,
        status: 'PENDING',
        subtotal: 0,
        total: 0,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return { success: false, error: 'Failed to create order' };
    }

    // 2. Add order items and capture their resulting auto-generated IDs to map accompaniments
    // We must do this carefully: we will insert items matching exactly and read their ids
    const orderItemsPayload = items.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity, // Pure item total (without accompaniments for semantic separation if desired, but we will adjust subtotal later)
      is_price_counted: true,
      parent_order_item_id: null,
    }));

    const { data: insertedItems, error: itemsError } = await admin
      .from('order_items')
      .insert(orderItemsPayload)
      .select('id, product_id');

    if (itemsError || !insertedItems) {
      console.error('Order items error:', itemsError);
      return { success: false, error: 'Failed to add items to order' };
    }

    // 3. Insert specific order accompaniments
    const accompanimentsPayload: any[] = [];
    
    items.forEach(cartItem => {
       if (cartItem.selectedAccompaniments && cartItem.selectedAccompaniments.length > 0) {
          // Find corresponding inserted order item (since products can be inserted multiple times, we blindly match sequentially or by ID).
          // For simplicity in a robust way, we lookup matching `product_id`. If multiple identical items exist, any matching is syntactically fine, but let's assume we map array by index since insertion preserves order (bulk insert returns array).
          const index = items.indexOf(cartItem);
          const parentOrderItemId = insertedItems[index]?.id;
          
          if (parentOrderItemId) {
             for (const acc of cartItem.selectedAccompaniments) {
                accompanimentsPayload.push({
                   order_id: order.id,
                   parent_order_item_id: parentOrderItemId,
                   accompaniment_id: acc.accompaniment_id,
                   quantity: acc.quantity * cartItem.quantity, // scale by cart item qty
                   unit_price_snapshot: acc.price,
                   total_price_snapshot: acc.price * acc.quantity * cartItem.quantity,
                   is_price_counted: true,
                });
             }
          }
       }
    });

    if (accompanimentsPayload.length > 0) {
      const { error: accError } = await admin.from('order_accompaniments').insert(accompanimentsPayload);
      if (accError) {
         console.error('Accompaniments items error:', accError);
         // Proceeding without error return to at least save the order
      }
    }

    // 4. Update total (including accompaniments)
    let grandTotal = 0;
    for (const item of items) {
      let itemCost = item.price * item.quantity;
      if (item.selectedAccompaniments) {
         for (const a of item.selectedAccompaniments) {
            itemCost += (a.price * a.quantity) * item.quantity;
         }
      }
      grandTotal += itemCost;
    }
    
    await admin.from('orders').update({ subtotal: grandTotal, total: grandTotal }).eq('id', order.id);

    // Notify structure staff
    await notifyStructureStaff({
      structureId: structureId,
      title: 'Nouvelle commande en ligne',
      body: `Commande reçue de ${options?.phone || 'Client'} d'un montant de ${grandTotal} FCFA`,
      url: `/orders/${order.id}`,
    });

    return { success: true, orderId: order.id };
  } catch (error) {
    console.error('Create client order exception:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}
