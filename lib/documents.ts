import type { Translator } from '@/lib/i18n/translate';

// Éléments communs aux documents imprimés (ticket, facture PDF, reçu de
// réservation, rapport Z) : identité de l'établissement et détail de la TVA.

export type DocumentStructure = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  niu?: string | null;
  rccm?: string | null;
  currency?: string | null;
};

/** Lignes d'en-tête : adresse, contact, NIU / RCCM (omises si non renseignées). */
export function structureIdentityLines(structure: DocumentStructure | null | undefined, t: Translator): string[] {
  if (!structure) return [];
  const location = [structure.address, structure.city, structure.country].filter(Boolean).join(', ');
  const contact = [structure.phone && t('documents.identity.phone', { phone: structure.phone }), structure.email]
    .filter(Boolean)
    .join(' · ');
  const fiscal = [
    structure.niu && t('documents.identity.niu', { niu: structure.niu }),
    structure.rccm && t('documents.identity.rccm', { rccm: structure.rccm }),
  ]
    .filter(Boolean)
    .join(' · ');
  return [location, contact, fiscal].filter((line): line is string => Boolean(line));
}

/** Libellé monétaire affiché sur les documents (FCFA pour XAF / XOF). */
export function documentCurrency(structure: DocumentStructure | null | undefined): string {
  const code = structure?.currency || 'XAF';
  return code === 'XAF' || code === 'XOF' ? 'FCFA' : code;
}

/** Montant pour les documents (espaces normaux : les polices PDF ne gèrent pas les espaces fines). */
export function formatDocumentAmount(value: number | string | null | undefined, currencyLabel = 'FCFA', intl = 'fr-CM') {
  return `${new Intl.NumberFormat(intl, { maximumFractionDigits: 0 })
    .format(Number(value) || 0)
    .replace(/\s/g, ' ')} ${currencyLabel}`;
}

export type TaxSummary = {
  /** Total hors taxe (hors pourboire). */
  net: number;
  tax: number;
  /** Taux en % (ex. 19.25). */
  rate: number;
  /** Total TTC hors pourboire. */
  totalWithTax: number;
};

/**
 * Détail de TVA d'une vente déjà enregistrée (commande ou réservation).
 * Null si la vente n'a pas de TVA (taux nul, ou vente antérieure au module).
 */
export function saleTaxSummary(sale: {
  total?: number | string | null;
  total_amount?: number | string | null;
  tax?: number | string | null;
  tax_amount?: number | string | null;
  tax_rate?: number | string | null;
  tip_amount?: number | string | null;
}): TaxSummary | null {
  const tax = Number(sale.tax ?? sale.tax_amount) || 0;
  const rate = Number(sale.tax_rate) || 0;
  if (tax <= 0 || rate <= 0) return null;

  const total = Number(sale.total ?? sale.total_amount) || 0;
  const tip = Number(sale.tip_amount) || 0;
  const totalWithTax = total - tip;
  return { net: totalWithTax - tax, tax, rate, totalWithTax };
}
