// Achats : calculs partagés entre serveur et navigateur (sans accès base).

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date. */
export function isoWeekday(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Prochaine date de livraison possible (YYYY-MM-DD) : après le délai du
 * fournisseur, le premier de ses jours de livraison (n'importe quel jour s'il
 * livre à la demande).
 */
export function nextDeliveryDate(deliveryDays: number[], leadTimeDays: number, from = new Date()) {
  // Date du jour au Cameroun (UTC+1)
  const local = new Date(from.getTime() + 3600_000);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + Math.max(0, leadTimeDays)));
  for (let i = 0; i < 7; i++) {
    const candidate = new Date(start.getTime() + i * 86_400_000);
    if (!deliveryDays.length || deliveryDays.includes(isoWeekday(candidate))) return candidate.toISOString().slice(0, 10);
  }
  return start.toISOString().slice(0, 10);
}

/** Lien WhatsApp vers un numéro (indicatif 237 ajouté aux numéros camerounais à 9 chiffres). */
export function whatsappLink(phone: string, text: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 9) digits = `237${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
