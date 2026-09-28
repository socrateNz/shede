import type { Locale } from '@/lib/i18n/config';

/**
 * Plan comptable SYSCOHADA révisé — comptes utilisés par un hôtel / restaurant.
 * Chaque point peut ajouter ses propres sous-comptes (table accounting_accounts),
 * par exemple 5211 « Banque Afriland » sous 521 « Banques ».
 *
 * Les libellés officiels sont en français ; l'anglais est une traduction d'usage.
 */
export type ChartAccount = { number: string; fr: string; en: string };

export const STANDARD_ACCOUNTS: ChartAccount[] = [
  // Classe 1 — Ressources durables
  { number: '101', fr: 'Capital social', en: 'Share capital' },
  { number: '104', fr: 'Compte de l’exploitant', en: 'Owner’s account' },
  { number: '111', fr: 'Réserve légale', en: 'Legal reserve' },
  { number: '121', fr: 'Report à nouveau créditeur', en: 'Retained earnings (credit)' },
  { number: '129', fr: 'Report à nouveau débiteur', en: 'Retained earnings (debit)' },
  { number: '131', fr: 'Résultat net : bénéfice', en: 'Net result: profit' },
  { number: '139', fr: 'Résultat net : perte', en: 'Net result: loss' },
  { number: '162', fr: 'Emprunts auprès des établissements de crédit', en: 'Bank loans' },

  // Classe 2 — Actif immobilisé
  { number: '213', fr: 'Logiciels et sites internet', en: 'Software and websites' },
  { number: '231', fr: 'Bâtiments', en: 'Buildings' },
  { number: '241', fr: 'Matériel et outillage', en: 'Equipment and tools' },
  { number: '244', fr: 'Matériel et mobilier', en: 'Furniture and office equipment' },
  { number: '245', fr: 'Matériel de transport', en: 'Vehicles' },
  { number: '284', fr: 'Amortissements du matériel', en: 'Depreciation of equipment' },

  // Classe 3 — Stocks
  { number: '311', fr: 'Marchandises', en: 'Goods for resale' },
  { number: '321', fr: 'Matières premières', en: 'Raw materials' },

  // Classe 4 — Tiers
  { number: '401', fr: 'Fournisseurs', en: 'Suppliers' },
  { number: '408', fr: 'Fournisseurs, factures non parvenues', en: 'Suppliers, invoices not received' },
  { number: '411', fr: 'Clients', en: 'Customers' },
  { number: '421', fr: 'Personnel, avances et acomptes', en: 'Staff advances' },
  { number: '422', fr: 'Personnel, rémunérations dues', en: 'Salaries payable' },
  { number: '431', fr: 'Sécurité sociale (CNPS)', en: 'Social security (CNPS)' },
  { number: '441', fr: 'État, impôt sur les bénéfices', en: 'Income tax payable' },
  { number: '4431', fr: 'TVA facturée sur ventes', en: 'Output VAT on sales' },
  { number: '4432', fr: 'TVA facturée sur prestations de services', en: 'Output VAT on services' },
  { number: '4441', fr: 'État, TVA due', en: 'VAT payable' },
  { number: '4449', fr: 'État, crédit de TVA à reporter', en: 'VAT credit carried forward' },
  { number: '4452', fr: 'TVA récupérable sur achats', en: 'Input VAT on purchases' },
  { number: '4454', fr: 'TVA récupérable sur services extérieurs', en: 'Input VAT on services' },
  { number: '447', fr: 'État, impôts retenus à la source et autres taxes', en: 'Other taxes payable' },
  { number: '471', fr: 'Débiteurs et créditeurs divers', en: 'Sundry debtors and creditors' },

  // Classe 5 — Trésorerie
  { number: '513', fr: 'Chèques à encaisser', en: 'Cheques to cash' },
  { number: '521', fr: 'Banques', en: 'Banks' },
  { number: '552', fr: 'Monnaie électronique (Mobile Money)', en: 'E-money (Mobile Money)' },
  { number: '571', fr: 'Caisse', en: 'Cash' },
  { number: '581', fr: 'Virements de fonds', en: 'Internal transfers' },

  // Classe 6 — Charges
  { number: '601', fr: 'Achats de marchandises', en: 'Purchases of goods' },
  { number: '602', fr: 'Achats de matières premières', en: 'Purchases of raw materials' },
  { number: '604', fr: 'Achats de matières et fournitures consommables', en: 'Consumable supplies' },
  { number: '6051', fr: 'Fournitures non stockables — eau', en: 'Water' },
  { number: '6052', fr: 'Fournitures non stockables — électricité', en: 'Electricity' },
  { number: '6053', fr: 'Autres énergies (gaz, carburant)', en: 'Other energy (gas, fuel)' },
  { number: '6055', fr: 'Fournitures de bureau', en: 'Office supplies' },
  { number: '6056', fr: 'Achats de petit matériel et outillage', en: 'Small equipment' },
  { number: '608', fr: 'Achats d’emballages', en: 'Packaging' },
  { number: '618', fr: 'Autres frais de transport', en: 'Other transport costs' },
  { number: '622', fr: 'Locations et charges locatives', en: 'Rent' },
  { number: '624', fr: 'Entretien, réparations et maintenance', en: 'Maintenance and repairs' },
  { number: '625', fr: 'Primes d’assurance', en: 'Insurance' },
  { number: '627', fr: 'Publicité, publications, relations publiques', en: 'Advertising' },
  { number: '628', fr: 'Frais de télécommunications', en: 'Telecommunications' },
  { number: '631', fr: 'Frais bancaires', en: 'Bank charges' },
  { number: '632', fr: 'Rémunérations d’intermédiaires et de conseils', en: 'Professional fees' },
  { number: '638', fr: 'Autres charges externes', en: 'Other external charges' },
  { number: '641', fr: 'Impôts et taxes directs', en: 'Direct taxes' },
  { number: '658', fr: 'Charges diverses', en: 'Sundry charges' },
  { number: '661', fr: 'Rémunérations directes versées au personnel', en: 'Salaries' },
  { number: '664', fr: 'Charges sociales', en: 'Social charges' },
  { number: '671', fr: 'Intérêts des emprunts', en: 'Loan interest' },
  { number: '681', fr: 'Dotations aux amortissements d’exploitation', en: 'Depreciation expense' },

  // Classe 7 — Produits
  { number: '701', fr: 'Ventes de marchandises', en: 'Sales of goods' },
  { number: '7061', fr: 'Services vendus — hébergement', en: 'Services sold — accommodation' },
  { number: '7062', fr: 'Services vendus — restauration', en: 'Services sold — food service' },
  { number: '707', fr: 'Produits accessoires (livraison, emballage)', en: 'Ancillary income (delivery, packaging)' },
  { number: '758', fr: 'Produits divers', en: 'Sundry income' },
];

/** Libellés des rubriques (2 premiers chiffres) pour les états financiers. */
export const RUBRICS: Record<string, { fr: string; en: string }> = {
  '10': { fr: 'Capital', en: 'Capital' },
  '11': { fr: 'Réserves', en: 'Reserves' },
  '12': { fr: 'Report à nouveau', en: 'Retained earnings' },
  '13': { fr: 'Résultat net de l’exercice', en: 'Net result for the year' },
  '16': { fr: 'Emprunts et dettes assimilées', en: 'Loans' },
  '21': { fr: 'Immobilisations incorporelles', en: 'Intangible assets' },
  '23': { fr: 'Bâtiments et installations', en: 'Buildings' },
  '24': { fr: 'Matériel, mobilier', en: 'Equipment and furniture' },
  '28': { fr: 'Amortissements', en: 'Depreciation' },
  '31': { fr: 'Marchandises', en: 'Goods' },
  '32': { fr: 'Matières premières', en: 'Raw materials' },
  '40': { fr: 'Fournisseurs', en: 'Suppliers' },
  '41': { fr: 'Clients', en: 'Customers' },
  '42': { fr: 'Personnel', en: 'Staff' },
  '43': { fr: 'Organismes sociaux', en: 'Social security' },
  '44': { fr: 'État et collectivités', en: 'State and taxes' },
  '47': { fr: 'Débiteurs et créditeurs divers', en: 'Sundry debtors and creditors' },
  '51': { fr: 'Valeurs à encaisser', en: 'Items to cash' },
  '52': { fr: 'Banques', en: 'Banks' },
  '55': { fr: 'Monnaie électronique', en: 'E-money' },
  '57': { fr: 'Caisse', en: 'Cash' },
  '58': { fr: 'Virements internes', en: 'Internal transfers' },
  '60': { fr: 'Achats', en: 'Purchases' },
  '61': { fr: 'Transports', en: 'Transport' },
  '62': { fr: 'Services extérieurs A', en: 'External services A' },
  '63': { fr: 'Services extérieurs B', en: 'External services B' },
  '64': { fr: 'Impôts et taxes', en: 'Taxes' },
  '65': { fr: 'Autres charges', en: 'Other charges' },
  '66': { fr: 'Charges de personnel', en: 'Staff costs' },
  '67': { fr: 'Frais financiers', en: 'Financial charges' },
  '68': { fr: 'Dotations aux amortissements', en: 'Depreciation' },
  '70': { fr: 'Ventes et prestations', en: 'Sales and services' },
  '75': { fr: 'Autres produits', en: 'Other income' },
  '77': { fr: 'Revenus financiers', en: 'Financial income' },
};

export type AccountLabel = { number: string; label: string; custom: boolean };

/** Plan du point : comptes standard + sous-comptes du point, triés par numéro. */
export function buildChart(
  locale: Locale,
  custom: { number: string; label: string }[] = []
): AccountLabel[] {
  const map = new Map<string, AccountLabel>();
  for (const a of STANDARD_ACCOUNTS) map.set(a.number, { number: a.number, label: a[locale], custom: false });
  for (const a of custom) if (!map.has(a.number)) map.set(a.number, { number: a.number, label: a.label, custom: true });
  return [...map.values()].sort((x, y) => x.number.localeCompare(y.number));
}

/** Libellé d'un compte : le compte lui-même, sinon son parent le plus proche. */
export function accountLabel(chart: AccountLabel[], number: string): string {
  const byNumber = new Map(chart.map((a) => [a.number, a.label]));
  for (let length = number.length; length >= 2; length--) {
    const label = byNumber.get(number.slice(0, length));
    if (label) return label;
  }
  return number;
}

export function rubricLabel(locale: Locale, number: string) {
  return RUBRICS[number.slice(0, 2)]?.[locale] ?? number.slice(0, 2);
}

export function accountClass(number: string) {
  return Number(number[0]);
}
