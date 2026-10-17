// Facturation clients : calculs purs (sans base), partagés par le serveur et les écrans.
// Montants en XAF : arrondis à l'unité, comme sur les tickets et les factures de caisse.

export const DOCUMENT_KINDS = ['QUOTE', 'INVOICE', 'CREDIT_NOTE'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = ['DRAFT', 'ISSUED', 'ACCEPTED', 'REFUSED', 'CONVERTED', 'CANCELLED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Nature d'une ligne → compte de produit SYSCOHADA et compte de TVA collectée. */
export const LINE_NATURES = {
  services: { account: '706', vat: '4432' },
  goods: { account: '701', vat: '4431' },
  products: { account: '702', vat: '4431' },
  works: { account: '704', vat: '4432' },
  ancillary: { account: '707', vat: '4431' },
} as const;
export type LineNature = keyof typeof LINE_NATURES;
export const LINE_NATURE_KEYS = Object.keys(LINE_NATURES) as LineNature[];

export function natureOfAccount(account: string): LineNature {
  return LINE_NATURE_KEYS.find((k) => LINE_NATURES[k].account === account) ?? 'services';
}

export type LineInput = {
  description: string;
  quantity: number;
  unitPrice: number; // HT
  discountPercent?: number;
  taxRate: number; // %
  nature?: LineNature;
};

export type ComputedLine = LineInput & { totalHt: number; taxAmount: number; account: string; vatAccount: string };

export type DocumentTotals = {
  lines: ComputedLine[];
  subtotalHt: number;
  taxAmount: number;
  totalTtc: number;
  /** TVA par taux (récapitulatif obligatoire sur la facture). */
  taxByRate: { rate: number; base: number; tax: number }[];
};

const round = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Totaux d'un document : chaque ligne est arrondie, puis additionnée (le total égale la somme des lignes imprimées). */
export function computeDocumentTotals(input: LineInput[]): DocumentTotals {
  const lines = input.map((line) => {
    const quantity = Number(line.quantity) || 0;
    const unitPrice = Number(line.unitPrice) || 0;
    const discount = clamp(Number(line.discountPercent) || 0, 0, 100);
    const taxRate = clamp(Number(line.taxRate) || 0, 0, 100);
    const nature = line.nature ?? 'services';
    const totalHt = round(quantity * unitPrice * (1 - discount / 100));
    const taxAmount = round((totalHt * taxRate) / 100);
    return {
      ...line,
      quantity,
      unitPrice,
      discountPercent: discount,
      taxRate,
      nature,
      totalHt,
      taxAmount,
      account: LINE_NATURES[nature].account,
      vatAccount: LINE_NATURES[nature].vat,
    };
  });

  const byRate = new Map<number, { base: number; tax: number }>();
  for (const l of lines) {
    const entry = byRate.get(l.taxRate) ?? { base: 0, tax: 0 };
    entry.base += l.totalHt;
    entry.tax += l.taxAmount;
    byRate.set(l.taxRate, entry);
  }
  const subtotalHt = lines.reduce((s, l) => s + l.totalHt, 0);
  const taxAmount = lines.reduce((s, l) => s + l.taxAmount, 0);
  return {
    lines,
    subtotalHt,
    taxAmount,
    totalTtc: subtotalHt + taxAmount,
    taxByRate: [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, v]) => ({ rate, ...v })),
  };
}

/** Échéance : date d'émission + délai de paiement du client (jours). */
export function dueDateFrom(issueDate: string, termsDays: number) {
  const d = new Date(`${issueDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.round(termsDays || 0)));
  return d.toISOString().slice(0, 10);
}

export type PaymentState = 'unpaid' | 'partial' | 'paid';

/** Reste dû d'une facture : total − encaissé − crédité par avoir. */
export function remainingDue(doc: { total_ttc: number; amount_paid: number; amount_credited?: number }) {
  return Math.max(0, round((Number(doc.total_ttc) || 0) - (Number(doc.amount_paid) || 0) - (Number(doc.amount_credited) || 0)));
}

export function paymentState(doc: { total_ttc: number; amount_paid: number; amount_credited?: number }): PaymentState {
  const due = remainingDue(doc);
  if (due === 0) return 'paid';
  return (Number(doc.amount_paid) || 0) + (Number(doc.amount_credited) || 0) > 0 ? 'partial' : 'unpaid';
}

/** Jours de retard (0 si non échue ou réglée). */
export function daysOverdue(doc: { due_date: string | null; total_ttc: number; amount_paid: number; amount_credited?: number }, today: string) {
  if (!doc.due_date || remainingDue(doc) === 0 || doc.due_date >= today) return 0;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${doc.due_date}T00:00:00Z`)) / 86_400_000);
}

/** Tranche de la balance âgée des créances. */
export function agingBucket(days: number): 'current' | 'd30' | 'd60' | 'd90' | 'over90' {
  if (days <= 0) return 'current';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  if (days <= 90) return 'd90';
  return 'over90';
}
