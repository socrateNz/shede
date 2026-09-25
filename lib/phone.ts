/**
 * Numéros de téléphone camerounais : 9 chiffres, commençant par 6 (mobile)
 * ou 2 (fixe), avec ou sans indicatif +237 / 00237 / 237.
 */

/** Renvoie le numéro au format international « +2376XXXXXXXX », ou null s'il est invalide. */
export function normalizeCameroonPhone(input: string | null | undefined): string | null {
  const digits = String(input ?? '').replace(/[^\d]/g, '');
  const local = digits.startsWith('00237')
    ? digits.slice(5)
    : digits.startsWith('237') && digits.length === 12
      ? digits.slice(3)
      : digits;
  return /^[26]\d{8}$/.test(local) ? `+237${local}` : null;
}

/** « +237 6 99 12 34 56 » pour l'affichage. */
export function formatCameroonPhone(input: string | null | undefined): string {
  const normalized = normalizeCameroonPhone(input);
  if (!normalized) return String(input ?? '');
  const n = normalized.slice(4);
  return `+237 ${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

/** Lien WhatsApp (wa.me) vers ce numéro, ou null. */
export function whatsappLink(input: string | null | undefined): string | null {
  const normalized = normalizeCameroonPhone(input);
  return normalized ? `https://wa.me/${normalized.slice(1)}` : null;
}
