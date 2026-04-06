'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function getPromotions() {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from('promotions')
      .select('*')
      .eq('structure_id', session.structureId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get promotions error:', error);
    return [];
  }
}

export async function getActivePromotionsForClient(structureId: string) {
  try {
    const admin = getAdminSupabase();
    const now = new Date().toISOString();
    
    // Fetch active promotions within the valid date range
    const { data, error } = await admin
      .from('promotions')
      .select('*, products(name)')
      .eq('structure_id', structureId)
      .eq('is_active', true)
      .neq('promo_mode', 'CODE')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get active promotions for client error:', error);
    return [];
  }
}

export async function getAllGlobalActivePromotions() {
  try {
    const admin = getAdminSupabase();
    const now = new Date().toISOString();
    
    const { data: promotions, error } = await admin
      .from('promotions')
      .select('*, structures!inner(id, name, modules), products(name)')
      .eq('is_active', true)
      .neq('promo_mode', 'CODE')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Filter to only include promotions from structures that have the CLIENT_APP module
    return (promotions || []).filter(p => {
       const modules = p.structures?.modules as string[] || [];
       return modules.includes('CLIENT_APP') && modules.includes('PROMOTION');
    });
  } catch (error) {
    console.error('Get all global active promotions error:', error);
    return [];
  }
}

export async function createPromotion(formData: FormData) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  // --- Common Fields ---
  const name = String(formData.get('name') || '').trim();
  const startDate = String(formData.get('start_date') || '');
  const endDate = String(formData.get('end_date') || '');
  const promoMode = String(formData.get('promo_mode') || 'STANDARD') as 'STANDARD' | 'CODE' | 'BUY_X_GET_Y';
  
  // --- STANDARD & CODE Fields ---
  const type = String(formData.get('type') || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED';
  const value = Number(formData.get('value') || 0);
  const scope = String(formData.get('scope') || 'ORDER') as 'PRODUCT' | 'ORDER';
  const productIdRaw = formData.get('product_id');
  const productId = (productIdRaw && productIdRaw !== 'none') ? String(productIdRaw) : null;
  const minOrderAmount = Number(formData.get('min_order_amount') || 0);
  
  // --- CODE Specific Fields ---
  const codeNameRaw = formData.get('code_name');
  const codeName = codeNameRaw ? String(codeNameRaw).trim().toUpperCase() : null;
  const usageLimitRaw = formData.get('usage_limit');
  const usageLimit = usageLimitRaw ? parseInt(String(usageLimitRaw)) : null;

  // --- BUY_X_GET_Y Specific Fields ---
  const requiredQtyRaw = formData.get('required_qty');
  const requiredQty = requiredQtyRaw ? parseInt(String(requiredQtyRaw)) : null;
  const freeQtyRaw = formData.get('free_qty');
  const freeQty = freeQtyRaw ? parseInt(String(freeQtyRaw)) : null;
  const isCumulative = formData.get('is_cumulative') === 'on';

  // --- Validations ---
  if (!name || !startDate || !endDate) {
    return { success: false, error: 'Champs obligatoires manquants' };
  }

  if (promoMode === 'STANDARD' || promoMode === 'CODE') {
    if (value <= 0) return { success: false, error: 'La valeur de la réduction doit être supérieure à 0' };
    if (promoMode === 'CODE' && !codeName) return { success: false, error: 'Le code promo est requis pour ce mode' };
  } else if (promoMode === 'BUY_X_GET_Y') {
    if (!requiredQty || !freeQty) return { success: false, error: 'Les quantités (X et Y) sont requises pour ce mode' };
    if (!productId) return { success: false, error: 'Un produit spécifique doit être sélectionné pour le Buy X Get Y' };
  }

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from('promotions')
      .insert({
        name,
        type: promoMode === 'BUY_X_GET_Y' ? 'PERCENTAGE' : type, // Fallback for DB constraint if needed
        value: promoMode === 'BUY_X_GET_Y' ? 0 : value,
        scope: promoMode === 'BUY_X_GET_Y' ? 'PRODUCT' : scope,
        product_id: productId,
        min_order_amount: minOrderAmount,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        structure_id: session.structureId,
        is_active: true,
        promo_mode: promoMode,
        code_name: promoMode === 'CODE' ? codeName : null,
        usage_limit: promoMode === 'CODE' ? usageLimit : null,
        used_count: 0,
        required_qty: promoMode === 'BUY_X_GET_Y' ? requiredQty : null,
        free_qty: promoMode === 'BUY_X_GET_Y' ? freeQty : null,
        is_cumulative: promoMode === 'BUY_X_GET_Y' ? isCumulative : true
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/promotions');
    return { success: true, promotion: data };
  } catch (error: any) {
    console.error('Create promotion error:', error);
    return { success: false, error: error.message || 'Failed to create promotion' };
  }
}

export async function togglePromotionStatus(promotionId: string, isActive: boolean) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('promotions')
      .update({ is_active: isActive })
      .eq('id', promotionId)
      .eq('structure_id', session.structureId);

    if (error) throw error;

    revalidatePath('/promotions');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Validates a promo code and returns the discount details
 */
export async function validatePromoCode(code: string, structureId: string, userId?: string, phone?: string) {
  try {
    const admin = getAdminSupabase();

    // 1. Check Module Activation
    const { data: structure, error: structError } = await admin
      .from('structures')
      .select('modules')
      .eq('id', structureId)
      .single();

    if (structError || !structure) return { valid: false, error: 'Structure not found' };
    
    const modules = (structure.modules as string[]) || [];
    if (!modules.includes('PROMOTION')) {
      return { valid: false, error: 'Promotion module not enabled for this establishment' };
    }

    // 2. Find Promotion with this code in the structure
    const { data: promotion, error: codeError } = await admin
      .from('promotions')
      .select('*')
      .eq('promo_mode', 'CODE')
      .eq('code_name', code.toUpperCase())
      .eq('structure_id', structureId)
      .single();

    if (codeError || !promotion) return { valid: false, error: 'Invalid promo code' };

    if (!promotion.is_active) {
      return { valid: false, error: 'Promo code not active' };
    }

    // 3. Check Dates
    const now = new Date();
    const start = new Date(promotion.start_date);
    const end = new Date(promotion.end_date);
    if (now < start) return { valid: false, error: 'Promo code not yet active' };
    if (now > end) return { valid: false, error: 'Promo code has expired' };

    // 4. Check Global Usage Limit
    if (promotion.usage_limit !== null && promotion.used_count >= promotion.usage_limit) {
      return { valid: false, error: 'Usage maximum du code promo atteint' };
    }

    // 5. Check Single-Use Per User/Phone
    // If we have identification, check if used before
    if (userId || phone) {
      const query = admin
        .from('orders')
        .select('id')
        .eq('promotion_id', promotion.id)
        .neq('status', 'CANCELLED'); // Allow reuse if previous order was cancelled

      if (userId && phone) {
        query.or(`user_id.eq.${userId},phone.eq.${phone},client_id.eq.${userId}`);
      } else if (userId) {
        query.or(`user_id.eq.${userId},client_id.eq.${userId}`);
      } else if (phone) {
        query.eq('phone', phone);
      }

      const { data: existing, error: usageError } = await query.limit(1);
      
      if (existing && existing.length > 0) {
        return { valid: false, error: 'Vous avez déjà utilisé ce code promo' };
      }
    }

    // Return the full promotion details
    return {
      valid: true,
      promotionId: promotion.id,
      name: promotion.name,
      type: promotion.type,
      value: promotion.value,
      scope: promotion.scope,
      productId: promotion.product_id,
      minOrderAmount: promotion.min_order_amount
    };
  } catch (error) {
    console.error('Validate promo code error:', error);
    return { valid: false, error: 'Failed to validate promo code' };
  }
}

export async function updatePromotion(promotionId: string, formData: FormData) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const name = String(formData.get('name') || '').trim();
  const startDate = String(formData.get('start_date') || '');
  const endDate = String(formData.get('end_date') || '');
  
  // Note: promo_mode is usually fixed after creation, but we extract it from formData if provided
  const type = String(formData.get('type') || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED';
  const value = Number(formData.get('value') || 0);
  const scope = String(formData.get('scope') || 'ORDER') as 'PRODUCT' | 'ORDER';
  const productIdRaw = formData.get('product_id');
  const productId = (productIdRaw && productIdRaw !== 'none') ? String(productIdRaw) : null;
  const minOrderAmount = Number(formData.get('min_order_amount') || 0);
  
  const codeNameRaw = formData.get('code_name');
  const codeName = codeNameRaw ? String(codeNameRaw).trim().toUpperCase() : null;
  const usageLimitRaw = formData.get('usage_limit');
  const usageLimit = usageLimitRaw ? parseInt(String(usageLimitRaw)) : null;

  const requiredQtyRaw = formData.get('required_qty');
  const requiredQty = requiredQtyRaw ? parseInt(String(requiredQtyRaw)) : null;
  const freeQtyRaw = formData.get('free_qty');
  const freeQty = freeQtyRaw ? parseInt(String(freeQtyRaw)) : null;
  const isCumulative = formData.get('is_cumulative') === 'on' || formData.get('is_cumulative') === 'true';

  if (!name || !startDate || !endDate) {
    return { success: false, error: 'Champs obligatoires manquants' };
  }

  try {
    const admin = getAdminSupabase();
    
    // First fetch current to check mode and structure
    const { data: current } = await admin.from('promotions').select('*').eq('id', promotionId).single();
    if (!current || current.structure_id !== session.structureId) {
      return { success: false, error: 'Promotion introuvable' };
    }

    const updatePayload: any = {
      name,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString()
      // Note: removed updated_at as it's missing in some schemas
    };

    if (current.promo_mode === 'STANDARD' || current.promo_mode === 'CODE') {
      updatePayload.type = type;
      updatePayload.value = value;
      updatePayload.scope = scope;
      updatePayload.product_id = productId;
      updatePayload.min_order_amount = minOrderAmount;
      if (current.promo_mode === 'CODE') {
        updatePayload.code_name = codeName;
        updatePayload.usage_limit = usageLimit;
      }
    } else if (current.promo_mode === 'BUY_X_GET_Y') {
       updatePayload.product_id = productId;
       updatePayload.required_qty = requiredQty;
       updatePayload.free_qty = freeQty;
       updatePayload.is_cumulative = isCumulative;
    }

    const { error } = await admin
      .from('promotions')
      .update(updatePayload)
      .eq('id', promotionId)
      .eq('structure_id', session.structureId);

    if (error) throw error;

    revalidatePath('/promotions');
    return { success: true };
  } catch (error: any) {
    console.error('Update promotion error:', error);
    return { success: false, error: error.message || 'Failed to update promotion' };
  }
}

export async function deletePromotion(promotionId: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('promotions')
      .delete()
      .eq('id', promotionId)
      .eq('structure_id', session.structureId);

    if (error) throw error;

    revalidatePath('/promotions');
    return { success: true };
  } catch (error: any) {
    console.error('Delete promotion error:', error);
    return { success: false, error: error.message || 'Failed to delete promotion' };
  }
}/**
 * Records the usage of a promo code
 */
export async function recordPromoUsage(promotionId: string, userId?: string) {
  const admin = getAdminSupabase();
  
  // Increment counter safely using raw update (or RPC if available)
  const { data: current } = await admin.from('promotions').select('used_count').eq('id', promotionId).single();
  if (current) {
    await admin.from('promotions').update({ used_count: (current.used_count || 0) + 1 }).eq('id', promotionId);
  }
}
