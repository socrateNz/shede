import { getAdminSupabase } from '@/lib/supabase';
import { getTranslations } from '@/lib/i18n/server';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_ACCOUNTS,
  SALES_ACCOUNTS,
  SUPPLIERS_ACCOUNT,
  treasuryAccount,
  type ExpenseCategory,
  type Journal,
} from '@/lib/accounting/mapping';
import { LINE_NATURES, natureOfAccount } from '@/lib/invoicing';

// Écritures comptables (docs/phase12-accounting.sql). Module serveur : jamais
// importé par un composant client ni exposé comme Server Action.
//
// Les écritures automatiques sont libellées dans la langue par défaut du
// logiciel (français), comme les pièces comptables officielles.

export type EntryLine = {
  account: string;
  label?: string;
  debit?: number;
  credit?: number;
  supplier_id?: string | null;
  /** Client facturé (compte 411), docs/phase24-invoicing.sql. */
  customer_id?: string | null;
};

export type PostEntryInput = {
  structureId: string;
  journal: Journal;
  date: string; // AAAA-MM-JJ
  label: string;
  reference?: string | null;
  sourceType?: string;
  sourceId?: string | null;
  reversalOf?: string | null;
  createdBy?: string | null;
  lines: EntryLine[];
};

export type AccountingErrorCode = 'PERIOD_LOCKED' | 'UNBALANCED' | 'INVALID_LINES' | 'NOT_INSTALLED' | 'FAILED';

export class AccountingError extends Error {
  constructor(public code: AccountingErrorCode, message: string) {
    super(message);
  }
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Date comptable (AAAA-MM-JJ) à l'heure du Cameroun (UTC+1). */
export function accountingDate(value: string | Date | null | undefined = new Date()) {
  const d = value ? new Date(value) : new Date();
  return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Enregistre une écriture équilibrée et renvoie son id (idempotent par document source). */
export async function postEntry(input: PostEntryInput): Promise<string> {
  const lines = input.lines
    .map((l) => ({
      account: l.account,
      label: l.label ?? input.label,
      debit: round2(l.debit ?? 0),
      credit: round2(l.credit ?? 0),
      supplier_id: l.supplier_id ?? null,
      // Client facturé (411) : ignoré par la base tant que phase24 n'est pas exécutée
      ...(l.customer_id ? { customer_id: l.customer_id } : {}),
    }))
    .filter((l) => l.debit > 0 || l.credit > 0);

  const { data, error } = await getAdminSupabase().rpc('post_accounting_entry', {
    p_structure_id: input.structureId,
    p_journal: input.journal,
    p_entry_date: input.date,
    p_label: input.label.slice(0, 250),
    p_reference: input.reference ?? null,
    p_source_type: input.sourceType ?? 'MANUAL',
    p_source_id: input.sourceId ?? null,
    p_reversal_of: input.reversalOf ?? null,
    p_created_by: input.createdBy ?? null,
    p_lines: lines,
  });

  if (error) {
    const message = error.message || '';
    if (message.includes('ACCOUNTING_PERIOD_LOCKED')) throw new AccountingError('PERIOD_LOCKED', message);
    if (message.includes('ACCOUNTING_UNBALANCED')) throw new AccountingError('UNBALANCED', message);
    if (message.includes('ACCOUNTING_INVALID_LINES')) throw new AccountingError('INVALID_LINES', message);
    if (error.code === 'PGRST202' || message.includes('post_accounting_entry')) {
      throw new AccountingError('NOT_INSTALLED', message);
    }
    throw new AccountingError('FAILED', message);
  }
  return data as string;
}

/** Le point a-t-il le module Comptabilité ? */
async function hasAccountingModule(structureId: string) {
  const { data } = await getAdminSupabase().from('structures').select('modules').eq('id', structureId).maybeSingle();
  return Boolean((data?.modules as string[] | null)?.includes('COMPTABILITE'));
}

/**
 * Répartit `total` au prorata des poids, en francs entiers ; l'écart
 * d'arrondi va au poste le plus lourd pour que la somme soit exacte.
 */
export function allocate(total: number, weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (!entries.length || total <= 0) return {};
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  const result: Record<string, number> = {};
  let allocated = 0;
  for (const [key, w] of entries) {
    result[key] = Math.round((total * w) / sum);
    allocated += result[key];
  }
  const heaviest = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  result[heaviest] += total - allocated;
  return result;
}

const { t: tr } = getTranslations(DEFAULT_LOCALE);

/**
 * Écriture de vente d'une commande payée (journal VE, vente au comptant) :
 *   Débit  trésorerie (par moyen de paiement) [+ 411 si reste dû]
 *   Crédit 701 / 7062 / 707 (HT, au prorata des lignes)
 *   Crédit 4431 TVA collectée, 471 pourboires
 */
export async function postOrderSale(orderId: string, options: { force?: boolean } = {}) {
  const admin = getAdminSupabase();
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order || order.status !== 'COMPLETED') return null;
  if (!options.force && !(await hasAccountingModule(order.structure_id))) return null;

  const total = round2(order.total);
  if (total <= 0) return null;
  const tax = round2(order.tax);
  const tip = round2(order.tip_amount);
  const fees = (Number(order.delivery_fee) || 0) + (Number(order.takeaway_fee) || 0);
  const net = Math.max(0, total - tax - tip);

  // Poids de chaque compte de produit : lignes facturées selon leur destination.
  const { data: items } = await admin
    .from('order_items')
    .select('total_price, is_price_counted, products(destination)')
    .eq('order_id', orderId)
    .is('parent_order_item_id', null);
  const { data: accompaniments } = await admin
    .from('order_accompaniments')
    .select('total_price_snapshot, is_price_counted')
    .eq('order_id', orderId);

  const weights: Record<string, number> = { [SALES_ACCOUNTS.goods]: 0, [SALES_ACCOUNTS.food]: 0, [SALES_ACCOUNTS.fees]: fees };
  for (const item of items || []) {
    if (item.is_price_counted === false) continue;
    const product = Array.isArray(item.products) ? item.products[0] : (item.products as { destination?: string } | null);
    const account = product?.destination === 'BAR' ? SALES_ACCOUNTS.goods : SALES_ACCOUNTS.food;
    weights[account] += Number(item.total_price) || 0;
  }
  for (const acc of accompaniments || []) {
    if (acc.is_price_counted === false) continue;
    weights[SALES_ACCOUNTS.food] += Number(acc.total_price_snapshot) || 0;
  }
  if (Object.values(weights).every((w) => w <= 0)) weights[SALES_ACCOUNTS.food] = 1;
  const revenue = allocate(net, weights);

  const { data: payments } = await admin
    .from('payments')
    .select('amount, payment_method, status')
    .eq('order_id', orderId);
  const byAccount: Record<string, number> = {};
  let paid = 0;
  for (const p of payments || []) {
    if (p.status && p.status !== 'COMPLETED') continue;
    const amount = round2(p.amount);
    if (amount <= 0) continue;
    const account = treasuryAccount(p.payment_method);
    byAccount[account] = (byAccount[account] || 0) + amount;
    paid += amount;
  }
  // Paiement supérieur au total (arrondi) : on ramène le trésor au total.
  if (paid > total) {
    const largest = Object.entries(byAccount).sort((a, b) => b[1] - a[1])[0][0];
    byAccount[largest] = round2(byAccount[largest] - (paid - total));
    paid = total;
  }

  const ref = order.invoice_number || order.id.slice(0, 8).toUpperCase();
  const label = tr('accounting.auto.orderSale', { ref });
  const lines: EntryLine[] = [
    ...Object.entries(byAccount).map(([account, debit]) => ({ account, debit })),
    {
      // Commande marketplace : le reste dû l'est par la marketplace (4111), quel que
      // soit le chemin de clôture (livreur via l'API ou statut passé à la main).
      account: order.source === 'API' ? PAYMENT_ACCOUNTS.MARKETPLACE : SALES_ACCOUNTS.receivable,
      debit: round2(total - paid),
      label: tr('accounting.auto.receivable', { ref }),
    },
    ...Object.entries(revenue).map(([account, credit]) => ({ account, credit })),
    { account: SALES_ACCOUNTS.vat, credit: tax },
    { account: SALES_ACCOUNTS.tips, credit: tip, label: tr('accounting.auto.tips', { ref }) },
  ];

  return postEntry({
    structureId: order.structure_id,
    journal: 'VE',
    date: accountingDate(order.paid_at || order.updated_at || order.created_at),
    label,
    reference: order.invoice_number,
    sourceType: 'ORDER',
    sourceId: order.id,
    lines,
  });
}

/** Écriture d'une réservation payée : Débit caisse / Crédit 7061 + 4431. */
export async function postBookingSale(bookingId: string, options: { force?: boolean } = {}) {
  const admin = getAdminSupabase();
  const { data: booking } = await admin
    .from('bookings')
    .select('*, rooms(structure_id, number)')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return null;
  const room = Array.isArray(booking.rooms) ? booking.rooms[0] : booking.rooms;
  const structureId = room?.structure_id as string | undefined;
  if (!structureId) return null;
  if (!booking.is_paid && booking.status !== 'COMPLETED') return null;
  if (!options.force && !(await hasAccountingModule(structureId))) return null;

  const total = round2(booking.total_amount);
  if (total <= 0) return null;
  const tax = Math.min(total, round2(booking.tax_amount));

  const ref = booking.invoice_number || booking.id.slice(0, 8).toUpperCase();
  return postEntry({
    structureId,
    journal: 'VE',
    date: accountingDate(booking.updated_at || booking.created_at),
    label: tr('accounting.auto.bookingSale', { ref, room: room?.number ?? '' }),
    reference: booking.invoice_number,
    sourceType: 'BOOKING',
    sourceId: booking.id,
    lines: [
      { account: treasuryAccount(booking.payment_method), debit: total },
      { account: SALES_ACCOUNTS.accommodation, credit: total - tax },
      { account: SALES_ACCOUNTS.vat, credit: tax },
    ],
  });
}

type ExpenseRow = {
  id: string;
  structure_id: string;
  supplier_id: string | null;
  category: string;
  account: string;
  expense_date: string;
  label: string;
  reference: string | null;
  amount_ht: number;
  tax_amount: number;
  amount_ttc: number;
  payment_method: string | null;
  paid_at: string | null;
  /** Banque précise choisie au paiement (docs/phase25-bank.sql). */
  payment_account?: string | null;
};

function categoryOf(expense: ExpenseRow) {
  return EXPENSE_CATEGORIES[expense.category as ExpenseCategory] ?? EXPENSE_CATEGORIES.other;
}

/** Facture / charge (journal AC) : Débit charge HT + TVA récupérable / Crédit fournisseur TTC. */
export async function postExpense(expense: ExpenseRow, createdBy?: string) {
  const category = categoryOf(expense);
  const tax = category.vat ? round2(expense.tax_amount) : 0;
  const supplierId = category.counterpart === SUPPLIERS_ACCOUNT ? expense.supplier_id : null;
  return postEntry({
    structureId: expense.structure_id,
    journal: 'AC',
    date: expense.expense_date,
    label: expense.label,
    reference: expense.reference,
    sourceType: 'EXPENSE',
    sourceId: expense.id,
    createdBy,
    lines: [
      { account: expense.account, debit: round2(expense.amount_ttc) - tax },
      ...(category.vat ? [{ account: category.vat, debit: tax }] : []),
      { account: category.counterpart, credit: round2(expense.amount_ttc), supplier_id: supplierId },
    ],
  });
}

/** Règlement d'une dépense (journal TR) : Débit fournisseur / Crédit trésorerie. */
export async function postExpensePayment(expense: ExpenseRow, createdBy?: string) {
  const category = categoryOf(expense);
  const supplierId = category.counterpart === SUPPLIERS_ACCOUNT ? expense.supplier_id : null;
  return postEntry({
    structureId: expense.structure_id,
    journal: 'TR',
    date: expense.paid_at || expense.expense_date,
    label: tr('accounting.auto.expensePayment', { label: expense.label }),
    reference: expense.reference,
    sourceType: 'EXPENSE_PAYMENT',
    sourceId: expense.id,
    createdBy,
    lines: [
      { account: category.counterpart, debit: round2(expense.amount_ttc), supplier_id: supplierId },
      { account: expense.payment_account || treasuryAccount(expense.payment_method), credit: round2(expense.amount_ttc) },
    ],
  });
}

/** Contrepassation : écriture inverse, datée du jour (ou de `date`), journal OD. */
export async function reverseEntry(
  entryId: string,
  options: { createdBy?: string; date?: string; reason?: string; sourceType?: string } = {}
) {
  const admin = getAdminSupabase();
  const { data: entry } = await admin.from('accounting_entries').select('*').eq('id', entryId).maybeSingle();
  if (!entry) throw new AccountingError('INVALID_LINES', 'entry not found');
  const { data: lines } = await admin
    .from('accounting_lines')
    .select('*') // customer_id seulement après phase24 : on garde le tiers tel quel
    .eq('entry_id', entryId);

  return postEntry({
    structureId: entry.structure_id,
    journal: 'OD',
    date: options.date ?? accountingDate(),
    label: tr('accounting.auto.reversal', { number: entry.number }) + (options.reason ? ` — ${options.reason}` : ''),
    reference: entry.number,
    sourceType: options.sourceType ?? 'REVERSAL',
    sourceId: entry.id,
    reversalOf: entry.id,
    createdBy: options.createdBy,
    lines: (lines || []).map((l) => ({
      account: l.account,
      label: l.label,
      debit: Number(l.credit) || 0,
      credit: Number(l.debit) || 0,
      supplier_id: l.supplier_id,
      customer_id: l.customer_id ?? null,
    })),
  });
}

/**
 * Comptabilise une vente sans jamais faire échouer l'encaissement : une erreur
 * est journalisée ; le bouton « Générer les écritures manquantes » la rattrapera.
 */
export async function postSaleSafely(kind: 'ORDER' | 'BOOKING', id: string) {
  try {
    if (kind === 'ORDER') await postOrderSale(id);
    else await postBookingSale(id);
  } catch (error) {
    console.warn(`[accounting] écriture de vente non enregistrée (${kind} ${id}) :`, (error as Error).message);
  }
}

// ── Facturation clients (docs/phase24-invoicing.sql) ─────

/**
 * Facture (journal VE) : Débit 411 client TTC / Crédit ventes HT par compte + TVA collectée.
 * Avoir : écriture inverse. Les lignes à 0 sont ignorées. Renvoie l'id de l'écriture.
 */
export async function postSalesDocument(documentId: string, createdBy?: string | null) {
  const admin = getAdminSupabase();
  const { data: doc } = await admin
    .from('sales_documents')
    .select('id, structure_id, customer_id, kind, status, number, issue_date, subject, total_ttc, customers(name), sales_document_lines(account, total_ht, tax_amount)')
    .eq('id', documentId)
    .maybeSingle();
  if (!doc || doc.status !== 'ISSUED' || (doc.kind !== 'INVOICE' && doc.kind !== 'CREDIT_NOTE')) return null;

  const credit = doc.kind === 'INVOICE'; // facture : produits au crédit ; avoir : au débit
  const byAccount = new Map<string, number>();
  for (const line of (doc.sales_document_lines || []) as { account: string; total_ht: number; tax_amount: number }[]) {
    const nature = LINE_NATURES[natureOfAccount(line.account)];
    byAccount.set(line.account, (byAccount.get(line.account) ?? 0) + round2(line.total_ht));
    byAccount.set(nature.vat, (byAccount.get(nature.vat) ?? 0) + round2(line.tax_amount));
  }
  const customer = (Array.isArray(doc.customers) ? doc.customers[0] : doc.customers) as { name?: string } | null;
  const label = tr(credit ? 'accounting.auto.invoice' : 'accounting.auto.creditNote', { number: doc.number ?? '', name: customer?.name ?? '' });
  const total = round2(doc.total_ttc);
  if (total <= 0) return null;

  const lines: EntryLine[] = [
    { account: SALES_ACCOUNTS.receivable, customer_id: doc.customer_id, ...(credit ? { debit: total } : { credit: total }) },
    ...[...byAccount.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([account, amount]) => ({ account, ...(credit ? { credit: amount } : { debit: amount }) })),
  ];
  return postEntry({
    structureId: doc.structure_id,
    journal: 'VE',
    date: doc.issue_date,
    label,
    reference: doc.number,
    sourceType: doc.kind === 'INVOICE' ? 'SALES_INVOICE' : 'SALES_CREDIT_NOTE',
    sourceId: doc.id,
    createdBy: createdBy ?? null,
    lines,
  });
}

/** Encaissement d'une facture (journal TR) : Débit trésorerie / Crédit 411 client. */
export async function postSalesPayment(paymentId: string, createdBy?: string | null) {
  const admin = getAdminSupabase();
  const { data: payment } = await admin
    .from('sales_payments')
    .select('*, sales_documents(number, customer_id, customers(name))') // treasury_account : après phase25
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment) return null;
  const doc = (Array.isArray(payment.sales_documents) ? payment.sales_documents[0] : payment.sales_documents) as
    | { number: string | null; customer_id: string; customers: { name?: string } | { name?: string }[] | null }
    | null;
  if (!doc) return null;
  const customer = Array.isArray(doc.customers) ? doc.customers[0] : doc.customers;
  const amount = round2(payment.amount);
  return postEntry({
    structureId: payment.structure_id,
    journal: 'TR',
    date: payment.paid_at,
    label: tr('accounting.auto.invoicePayment', { number: doc.number ?? '', name: customer?.name ?? '' }),
    reference: payment.reference || doc.number,
    sourceType: 'SALES_PAYMENT',
    sourceId: payment.id,
    createdBy: createdBy ?? null,
    lines: [
      { account: (payment.treasury_account as string | null) || treasuryAccount(payment.payment_method), debit: amount },
      { account: SALES_ACCOUNTS.receivable, credit: amount, customer_id: doc.customer_id },
    ],
  });
}
