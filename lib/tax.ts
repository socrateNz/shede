/**
 * TVA — calcul commun aux commandes et aux réservations.
 *
 * Chaque point choisit si ses prix sont saisis TTC (la TVA est extraite du
 * montant, le total ne change pas) ou HT (la TVA s'ajoute au total).
 * Montants en francs CFA : arrondis à l'unité.
 */

/** Taux normal de TVA au Cameroun (17,5 % + centimes additionnels communaux). */
export const CAMEROON_VAT_RATE = 19.25;

export type TaxSettings = {
  /** Taux en pourcentage (ex. 19.25). 0 = pas de TVA. */
  rate: number;
  /** true : prix TTC ; false : prix HT. */
  pricesIncludeTax: boolean;
};

export function toTaxSettings(source: {
  tax_rate?: number | string | null;
  prices_include_tax?: boolean | null;
} | null | undefined): TaxSettings {
  const rate = Number(source?.tax_rate) || 0;
  return {
    rate: rate > 0 ? rate : 0,
    pricesIncludeTax: source?.prices_include_tax !== false,
  };
}

export type TaxBreakdown = {
  /** Montant hors taxe. */
  net: number;
  /** Montant de la TVA. */
  tax: number;
  /** Montant TTC à payer. */
  total: number;
};

/** Applique la TVA à une base taxable, selon le régime du point. */
export function computeTax(base: number, settings: TaxSettings): TaxBreakdown {
  const amount = Math.max(0, Math.round(base));
  if (settings.rate <= 0) return { net: amount, tax: 0, total: amount };

  const ratio = settings.rate / 100;
  if (settings.pricesIncludeTax) {
    const tax = Math.round(amount - amount / (1 + ratio));
    return { net: amount - tax, tax, total: amount };
  }
  const tax = Math.round(amount * ratio);
  return { net: amount, tax, total: amount + tax };
}

/** « 19,25 % » */
export function formatTaxRate(rate: number) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(rate)} %`;
}
