'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';

export async function createPayment(
  orderId: string,
  amount: number,
  paymentMethod: string,
  reference?: string,
  notes?: string
) {
  const session = await getSession();
  if (!session || !['CAISSE', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();

    // Get the order to verify it belongs to the structure
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, total')
      .eq('id', orderId)
      .eq('structure_id', session.structureId)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Order not found' };
    }

    // Verify amount matches order total
    if (amount > order.total) {
      return { success: false, error: 'Payment amount cannot exceed order total' };
    }

    // Create payment
    const { data: payment, error } = await admin
      .from('payments')
      .insert({
        order_id: orderId,
        amount,
        payment_method: paymentMethod,
        status: 'COMPLETED',
        reference: reference || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error || !payment) {
      return { success: false, error: 'Failed to create payment' };
    }

    // Update order status to COMPLETED
    await admin
      .from('orders')
      .update({ status: 'COMPLETED' })
      .eq('id', orderId);

    return { success: true, paymentId: payment.id };
  } catch (error) {
    console.error('Create payment error:', error);
    return { success: false, error: 'Failed to create payment' };
  }
}

export async function getOrderPayments(orderId: string) {
  try {
    const admin = getAdminSupabase();

    const { data: payments, error } = await admin
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return payments || [];
  } catch (error) {
    return [];
  }
}

export async function getPaymentsSummary(structureId: string, days: number = 30) {
  try {
    const admin = getAdminSupabase();

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const { data: payments, error } = await admin
      .from('payments')
      .select('*')
      .eq('status', 'COMPLETED')
      .in('order_id', (
        await admin
          .from('orders')
          .select('id')
          .eq('structure_id', structureId)
          .gte('created_at', dateFrom.toISOString())
      ).data?.map((o: any) => o.id) || []);

    if (error) {
      return {
        totalRevenue: 0,
        paymentCount: 0,
        paymentsByMethod: {},
      };
    }

    const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const paymentsByMethod: Record<string, number> = {};

    payments?.forEach((payment) => {
      const method = payment.payment_method || 'UNKNOWN';
      paymentsByMethod[method] = (paymentsByMethod[method] || 0) + payment.amount;
    });

    return {
      totalRevenue,
      paymentCount: payments?.length || 0,
      paymentsByMethod,
    };
  } catch (error) {
    return {
      totalRevenue: 0,
      paymentCount: 0,
      paymentsByMethod: {},
    };
  }
}
