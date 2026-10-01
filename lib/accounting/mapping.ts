/**
 * Correspondances utilisées par les écritures automatiques.
 * Le comptable peut ajuster ces comptes ici (ils doivent exister dans le plan).
 */

export const JOURNALS = ['VE', 'AC', 'TR', 'OD', 'AN'] as const;
export type Journal = (typeof JOURNALS)[number];

/** Compte de trésorerie débité selon le moyen de paiement. */
export const PAYMENT_ACCOUNTS: Record<string, string> = {
  CASH: '571',
  CARD: '521',
  TRANSFER: '521',
  CHEQUE: '513',
  MOBILE: '552',
  AUTRE: '571',
  // Encaissé par la marketplace, qui reverse ensuite au restaurant : créance sur elle.
  MARKETPLACE: '4111',
};
export const PAYMENT_METHODS = ['CASH', 'MOBILE', 'CARD', 'TRANSFER', 'CHEQUE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function treasuryAccount(method: string | null | undefined) {
  return PAYMENT_ACCOUNTS[String(method || 'CASH').toUpperCase()] ?? '571';
}

/** Comptes de produits des ventes. */
export const SALES_ACCOUNTS = {
  /** Boissons et articles du bar revendus en l'état */
  goods: '701',
  /** Repas (cuisine, accompagnements) */
  food: '7062',
  /** Nuitées */
  accommodation: '7061',
  /** Frais de livraison et d'emballage */
  fees: '707',
  /** TVA collectée */
  vat: '4431',
  /** Pourboires encaissés pour le personnel (à reverser) */
  tips: '471',
  /** Reste dû par le client si le paiement n'a pas couvert la commande */
  receivable: '411',
} as const;

/** Comptes de trésorerie suivis sur le tableau de bord. */
export const TREASURY_ACCOUNTS = ['571', '552', '521', '513'] as const;

export const SUPPLIERS_ACCOUNT = '401';

/**
 * Catégories de dépenses : compte de charge, compte de TVA récupérable
 * (null = pas de TVA) et compte de contrepartie (dette).
 */
export const EXPENSE_CATEGORIES = {
  goods: { account: '601', vat: '4452', counterpart: '401' },
  food: { account: '602', vat: '4452', counterpart: '401' },
  supplies: { account: '604', vat: '4452', counterpart: '401' },
  water: { account: '6051', vat: '4452', counterpart: '401' },
  electricity: { account: '6052', vat: '4452', counterpart: '401' },
  energy: { account: '6053', vat: '4452', counterpart: '401' },
  office: { account: '6055', vat: '4452', counterpart: '401' },
  smallEquipment: { account: '6056', vat: '4452', counterpart: '401' },
  packaging: { account: '608', vat: '4452', counterpart: '401' },
  transport: { account: '618', vat: '4454', counterpart: '401' },
  rent: { account: '622', vat: '4454', counterpart: '401' },
  maintenance: { account: '624', vat: '4454', counterpart: '401' },
  insurance: { account: '625', vat: null, counterpart: '401' },
  advertising: { account: '627', vat: '4454', counterpart: '401' },
  telecom: { account: '628', vat: '4454', counterpart: '401' },
  bankFees: { account: '631', vat: '4454', counterpart: '401' },
  fees: { account: '632', vat: '4454', counterpart: '401' },
  otherServices: { account: '638', vat: '4454', counterpart: '401' },
  taxes: { account: '641', vat: null, counterpart: '447' },
  salaries: { account: '661', vat: null, counterpart: '422' },
  social: { account: '664', vat: null, counterpart: '431' },
  other: { account: '658', vat: null, counterpart: '401' },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;
export const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return value in EXPENSE_CATEGORIES;
}

/** Comptes de TVA pour la déclaration. */
export const VAT_COLLECTED_ACCOUNTS = ['4431', '4432'];
export const VAT_DEDUCTIBLE_ACCOUNTS = ['4452', '4454'];
