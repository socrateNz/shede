'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { notifyStructureOrderCreated } from '@/app/actions/push';

export async function createOrder(
  tableNumber: number | null,
  notes: string | null
) {
  const session = await getSession();
  if (!session || !['CAISSE', 'SERVEUR', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
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

    await notifyStructureOrderCreated({
      structureId: session.structureId,
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
  if (!session || !['CAISSE', 'SERVEUR', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const tableNumberRaw = String(formData.get('tableNumber') || '').trim();
  const notesRaw = String(formData.get('notes') || '').trim();
  const itemsRaw = String(formData.get('items') || '');

  let parsedItems: Array<{ productId: string; quantity: number }> = [];
  try {
    const json = JSON.parse(itemsRaw);
    if (Array.isArray(json)) {
      parsedItems = json;
    }
  } catch (error) {
    return { success: false, error: 'Invalid order items format' };
  }

  const normalizedItems = parsedItems
    .map((item) => ({
      productId: String(item.productId || ''),
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

  if (normalizedItems.length === 0) {
    return { success: false, error: 'Please add at least one product' };
  }

  const uniqueProductIds = Array.from(new Set(normalizedItems.map((item) => item.productId)));
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

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        structure_id: session.structureId,
        user_id: session.userId,
        table_number: tableNumber,
        status: 'PENDING',
        notes,
        subtotal: 0,
        total: 0,
      })
      .select()
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Failed to create order' };
    }

    const orderItems = normalizedItems.map((item) => {
      const unitPrice = validProducts.get(item.productId) || 0;
      return {
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: unitPrice * item.quantity,
      };
    });

    const { error: itemsError } = await admin
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      await admin.from('orders').delete().eq('id', order.id).eq('structure_id', session.structureId);
      return { success: false, error: 'Failed to save order items' };
    }

    await updateOrderTotal(order.id);
    await notifyStructureOrderCreated({
      structureId: session.structureId,
      title: 'Nouvelle commande',
      body: `Commande ${order.id.slice(0, 8)} creee`,
      url: `/orders/${order.id}`,
    });
    return { success: true, orderId: order.id };
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
      })
      .select()
      .single();

    if (error || !item) {
      return { success: false, error: 'Failed to add item' };
    }

    // Update order totals
    await updateOrderTotal(orderId);

    return { success: true };
  } catch (error) {
    console.error('Add order item error:', error);
    return { success: false, error: 'Failed to add item' };
  }
}

async function updateOrderTotal(orderId: string) {
  const admin = getAdminSupabase();

  const { data: items } = await admin
    .from('order_items')
    .select('total_price')
    .eq('order_id', orderId);

  const subtotal = items?.reduce((sum, item) => sum + item.total_price, 0) || 0;
  const total = subtotal;

  await admin
    .from('orders')
    .update({
      subtotal,
      total,
    })
    .eq('id', orderId);
}

export async function updateOrderStatus(
  orderId: string,
  status: string
) {
  const session = await getSession();
  if (!session || !['CAISSE', 'SUPER_ADMIN'].includes(session.role)) {
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

export async function getOrder(orderId: string) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const admin = getAdminSupabase();

    const { data: order } = await admin
      .from('orders')
      .select('*, order_items(*, products(*))')
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
      .select('*')
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
