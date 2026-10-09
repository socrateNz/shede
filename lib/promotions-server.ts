import { getAdminSupabase } from '@/lib/supabase';

// Fonction interne aux actions serveur (commande caisse ou client), jamais appelable
// depuis le navigateur : sinon n'importe qui pourrait épuiser le quota d'un code promo.

/**
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
