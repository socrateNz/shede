'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { getStructureActiveShift } from './shifts';
import { processOrderStock } from './stock';
import { assignInvoiceNumber } from '@/lib/fiscal';
import { postSaleSafely } from '@/lib/accounting/posting';
import { te } from '@/lib/i18n/server';

export async function createPayment(
  orderId: string,
  amount: number,
  paymentMethod: string,
  reference?: string,
  notes?: string
) {
  const session = await getSession();
  if (!session || !['ADMIN', 'CAISSE', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  // Check if shift is open for structure
  const activeShift = await getStructureActiveShift(session.structureId as string);
  if (!activeShift) {
    return { success: false, error: await te('errors.registerClosedPayment') };
  }

  try {
    const admin = getAdminSupabase();

    // Get the order to verify it belongs to the structure
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, total, status')
      .eq('id', orderId)
      .eq('structure_id', session.structureId)
      .single();

    if (orderError || !order) {
      return { success: false, error: await te('errors.orderNotFound') };
    }

    // Verify amount matches order total
    if (amount > order.total) {
      return { success: false, error: await te('errors.paymentExceedsTotal') };
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
      return { success: false, error: await te('errors.paymentFailed') };
    }

    // Update order status to COMPLETED and record paid_at
    await admin
      .from('orders')
      .update({ status: 'COMPLETED', paid_at: new Date().toISOString() })
      .eq('id', orderId);

    // Deduct stock (products + accompaniments) now that the order is actually paid.
    // Guarded so a duplicate/replayed payment on an already-completed order can't
    // decrement stock twice.
    if (order.status !== 'COMPLETED') {
      await processOrderStock(orderId);
    }

    // Numéro de facture continu du point (idempotent : conservé si déjà attribué).
    await assignInvoiceNumber('ORDER', orderId);
    // Écriture de vente (module Comptabilité) ; n'interrompt jamais l'encaissement.
    await postSaleSafely('ORDER', orderId);

    return { success: true, paymentId: payment.id };
  } catch (error) {
    console.error('Create payment error:', error);
    return { success: false, error: await te('errors.paymentFailed') };
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
