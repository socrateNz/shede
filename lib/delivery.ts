import { getAdminSupabase } from '@/lib/supabase';
import { normalizeCameroonPhone } from '@/lib/phone';
import { getT } from '@/lib/i18n/server';

// Livraison (docs/phase10-delivery.sql). L'adresse suit l'usage camerounais :
// zone (quartier / secteur, qui fixe les frais) + point de repère, avec une
// position GPS facultative. Tout est vérifié côté serveur : les frais ne
// viennent jamais du navigateur.

export const DELIVERY_STATUSES = ['TO_ASSIGN', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type DeliveryRequest = {
  zoneId?: string | null;
  district?: string | null;
  landmark?: string | null;
  city?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  phone?: string | null;
};

export type DeliveryOrderFields = {
  consumption_type: 'DELIVERY';
  phone: string;
  delivery_zone_id: string;
  delivery_zone_name: string;
  delivery_fee: number;
  delivery_city: string | null;
  delivery_district: string;
  delivery_landmark: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_status: DeliveryStatus;
};

function parseCoordinate(value: unknown, limit: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** Valide une demande de livraison pour un point et renvoie les champs de la commande. */
export async function resolveDelivery(
  structureId: string,
  request: DeliveryRequest
): Promise<{ fields: DeliveryOrderFields } | { error: string }> {
  const admin = getAdminSupabase();
  const { t } = await getT();

  const { data: structure } = await admin
    .from('structures')
    .select('modules, city')
    .eq('id', structureId)
    .maybeSingle();
  if (!structure || !(structure.modules as string[] | null)?.includes('LIVRAISON')) {
    return { error: t('delivery.errors.notOffered') };
  }

  if (!request.zoneId) return { error: t('delivery.errors.chooseZone') };
  const { data: zone } = await admin
    .from('delivery_zones')
    .select('id, name, fee, is_active')
    .eq('id', request.zoneId)
    .eq('structure_id', structureId)
    .maybeSingle();
  if (!zone || !zone.is_active) return { error: t('delivery.errors.zoneUnavailable') };

  const landmark = String(request.landmark ?? '').trim();
  if (landmark.length < 3) {
    return { error: t('delivery.errors.landmarkRequired') };
  }

  const phone = normalizeCameroonPhone(request.phone);
  if (!phone) return { error: t('delivery.errors.invalidPhone') };

  return {
    fields: {
      consumption_type: 'DELIVERY',
      phone,
      delivery_zone_id: zone.id,
      delivery_zone_name: zone.name,
      delivery_fee: Math.max(0, Math.round(Number(zone.fee) || 0)),
      delivery_city: String(request.city ?? '').trim() || structure.city || null,
      delivery_district: String(request.district ?? '').trim() || zone.name,
      delivery_landmark: landmark.slice(0, 500),
      delivery_lat: parseCoordinate(request.lat, 90),
      delivery_lng: parseCoordinate(request.lng, 180),
      delivery_status: 'TO_ASSIGN',
    },
  };
}

/** Zones actives d'un point (pour le panier et la caisse). */
export async function getActiveDeliveryZones(structureId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('delivery_zones')
    .select('id, name, fee')
    .eq('structure_id', structureId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) return [];
  return (data || []).map((z) => ({ id: z.id as string, name: z.name as string, fee: Number(z.fee) || 0 }));
}

/** Lien Google Maps : position GPS si partagée, sinon recherche quartier + ville. */
export function deliveryMapLink(order: {
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_district?: string | null;
  delivery_city?: string | null;
}): string {
  if (order.delivery_lat != null && order.delivery_lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`;
  }
  const query = [order.delivery_district, order.delivery_city, 'Cameroun'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
