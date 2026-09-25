import { getAdminSupabase } from '@/lib/supabase';
import { computeTax, toTaxSettings, type TaxSettings } from '@/lib/tax';

// Accès serveur aux données fiscales (docs/phase9-fiscal.sql).
// Tolérant : si la migration n'est pas encore appliquée, les ventes
// continuent de fonctionner (sans photographie fiscale ni numéro).

/** Régime de TVA d'un point. `select('*')` : fonctionne avant et après la migration. */
export async function getStructureTaxSettings(structureId: string): Promise<TaxSettings> {
  const admin = getAdminSupabase();
  const { data } = await admin.from('structures').select('*').eq('id', structureId).maybeSingle();
  return toTaxSettings(data);
}

/** Enregistre la photographie fiscale d'une vente (colonnes de la phase 9). */
export async function saveTaxSnapshot(
  table: 'orders' | 'bookings',
  id: string,
  settings: TaxSettings
) {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from(table)
    .update({ tax_rate: settings.rate, prices_include_tax: settings.pricesIncludeTax })
    .eq('id', id);
  if (error) console.warn(`[fiscal] photographie fiscale non enregistrée (${table}) :`, error.message);
}

/** Montant d'une réservation (nuits × prix de la chambre) avec la TVA du point. */
export async function priceBooking(structureId: string, nights: number, roomPrice: number) {
  const settings = await getStructureTaxSettings(structureId);
  const { tax, total } = computeTax(nights * (Number(roomPrice) || 0), settings);
  return { total, tax, settings };
}

/** Enregistre la TVA d'une réservation (colonnes de la phase 9). */
export async function saveBookingTax(bookingId: string, tax: number, settings: TaxSettings) {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from('bookings')
    .update({ tax_amount: tax, tax_rate: settings.rate, prices_include_tax: settings.pricesIncludeTax })
    .eq('id', bookingId);
  if (error) console.warn('[fiscal] TVA de la réservation non enregistrée :', error.message);
}

/** Attribue le numéro de facture (continu par point) au paiement. Idempotent. */
export async function assignInvoiceNumber(kind: 'ORDER' | 'BOOKING', id: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc('assign_invoice_number', { p_kind: kind, p_id: id });
  if (error) {
    console.warn('[fiscal] numéro de facture non attribué :', error.message);
    return null;
  }
  return (data as string | null) ?? null;
}
