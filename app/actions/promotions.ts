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

  const name = String(formData.get('name') || '').trim();
  const type = String(formData.get('type') || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED';
  const value = Number(formData.get('value') || 0);
  const scope = String(formData.get('scope') || 'ORDER') as 'PRODUCT' | 'ORDER';
  const productIdRaw = formData.get('product_id');
  const productId = (productIdRaw && productIdRaw !== 'none') ? String(productIdRaw) : null;
  const minOrderAmount = Number(formData.get('min_order_amount') || 0);
  const startDate = String(formData.get('start_date') || '');
  const endDate = String(formData.get('end_date') || '');

  if (!name || value <= 0 || !startDate || !endDate) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from('promotions')
      .insert({
        name,
        type,
        value,
        scope,
        product_id: productId,
        min_order_amount: minOrderAmount,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        structure_id: session.structureId,
        is_active: true
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

export async function getPromoCodes(promotionId?: string) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    let query = admin.from('promo_codes').select('*, promotions(name)');
    
    if (promotionId) {
      query = query.eq('promotion_id', promotionId);
    } else {
      // Filter by structure through promotion relation
      const { data: promotions } = await admin.from('promotions').select('id').eq('structure_id', session.structureId);
      const promoIds = promotions?.map(p => p.id) || [];
      query = query.in('promotion_id', promoIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get promo codes error:', error);
    return [];
  }
}

export async function createPromoCode(formData: FormData) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const code = String(formData.get('code') || '').trim().toUpperCase();
  const promotionId = String(formData.get('promotion_id') || '');
  const usageLimitRaw = formData.get('usage_limit');
  const usageLimit = usageLimitRaw ? parseInt(String(usageLimitRaw)) : null;

  if (!code || !promotionId) {
    return { success: false, error: 'Code and Promotion are required' };
  }

  try {
    const admin = getAdminSupabase();
    
    // Verify promotion belongs to this structure
    const { data: promo } = await admin
      .from('promotions')
      .select('id')
      .eq('id', promotionId)
      .eq('structure_id', session.structureId)
      .single();

    if (!promo) return { success: false, error: 'Invalid promotion' };

    const { data, error } = await admin
      .from('promo_codes')
      .insert({
        code,
        promotion_id: promotionId,
        usage_limit: usageLimit,
        used_count: 0
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return { success: false, error: 'Promo code already exists' };
      throw error;
    }

    revalidatePath('/promotions');
    return { success: true, promoCode: data };
  } catch (error: any) {
    console.error('Create promo code error:', error);
    return { success: false, error: error.message || 'Failed to create promo code' };
  }
}

/**
 * Validates a promo code and returns the discount details
 */
export async function validatePromoCode(code: string, structureId: string, userId?: string) {
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

    // 2. Find Promo Code
    const { data: promoCode, error: codeError } = await admin
      .from('promo_codes')
      .select('*, promotions(*)')
      .eq('code', code.toUpperCase())
      .single();

    if (codeError || !promoCode) return { valid: false, error: 'Invalid promo code' };

    const promotion = promoCode.promotions;
    if (!promotion || promotion.structure_id !== structureId || !promotion.is_active) {
      return { valid: false, error: 'Promo code not active or invalid' };
    }

    // 3. Check Dates
    const now = new Date();
    const start = new Date(promotion.start_date);
    const end = new Date(promotion.end_date);
    if (now < start) return { valid: false, error: 'Promo code not yet active' };
    if (now > end) return { valid: false, error: 'Promo code has expired' };

    // 4. Check Global Usage Limit
    if (promoCode.usage_limit !== null && promoCode.used_count >= promoCode.usage_limit) {
      return { valid: false, error: 'Promo code usage limit reached' };
    }

    // 5. Check User Usage (if userId provided)
    if (userId) {
      const { data: usage, error: usageError } = await admin
        .from('promo_code_usages')
        .select('id')
        .eq('promo_code_id', promoCode.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (usage) return { valid: false, error: 'You have already used this promo code' };
    }

    return {
      valid: true,
      promoCodeId: promoCode.id,
      promotionId: promotion.id,
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

/**
 * Records the usage of a promo code
 */
export async function recordPromoUsage(promoCodeId: string, userId: string) {
  const admin = getAdminSupabase();
  
  // Start usage record
  const { error: usageError } = await admin
    .from('promo_code_usages')
    .insert({
      promo_code_id: promoCodeId,
      user_id: userId
    });

  if (usageError) {
    if (usageError.code === '23505') throw new Error('Promo code already used by this user');
    throw usageError;
  }

  // Increment counter
  const { error: updateError } = await admin.rpc('increment_promo_usage', { p_promo_code_id: promoCodeId });
  
  if (updateError) {
    // Fallback if RPC doesn't exist
    const { data: current } = await admin.from('promo_codes').select('used_count').eq('id', promoCodeId).single();
    await admin.from('promo_codes').update({ used_count: (current?.used_count || 0) + 1 }).eq('id', promoCodeId);
  }
}
