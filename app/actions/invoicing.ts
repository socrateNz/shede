'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { canPostEntries, ACCOUNTING_MODULE } from '@/lib/accounting/permissions';
import { accountingDate, postSalesDocument, postSalesPayment } from '@/lib/accounting/posting';
import { PAYMENT_METHODS } from '@/lib/accounting/mapping';
import { bankAccountNumber } from '@/lib/accounting/treasury';
import { buildMeta, emptyPage, pageRange, searchTerm, settlePage, type Paginated } from '@/lib/pagination';
import {
  computeDocumentTotals,
  dueDateFrom,
  LINE_NATURE_KEYS,
  natureOfAccount,
  type DocumentKind,
  type DocumentStatus,
  type LineInput,
  type LineNature,
} from '@/lib/invoicing';

// Facturation clients (docs/phase24-invoicing.sql) : clients, devis, factures, avoirs,
// encaissements. Réservé à l'administrateur et au comptable du point (module Comptabilité).

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINES = 100;

async function requireInvoicing() {
  const session = await getSession();
  if (!session?.structureId || !session.modules?.includes(ACCOUNTING_MODULE) || !canPostEntries(session.role)) return null;
  return session as typeof session & { structureId: string };
}

/** Message lisible pour une erreur SQL de la facturation (ou générique). */
async function invoicingError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error ?? '');
  if (message.includes('SALES_PAYMENT_TOO_HIGH')) return te('accounting.invoices.errors.paymentTooHigh');
  if (message.includes('SALES_CREDIT_TOO_HIGH')) return te('accounting.invoices.errors.creditTooHigh');
  if (message.includes('SALES_DOCUMENT_NOT_DRAFT')) return te('accounting.invoices.errors.notDraft');
  if (message.includes('PERIOD_LOCKED')) return te('accounting.errors.periodLocked');
  if (message.includes('relation') && message.includes('does not exist')) return te('accounting.invoices.errors.notInstalled');
  console.error('[invoicing]', error);
  return te('errors.unexpected');
}

function revalidateInvoicing(id?: string) {
  revalidatePath('/accounting/invoices');
  if (id) revalidatePath(`/accounting/invoices/${id}`);
  revalidatePath('/accounting/customers');
  revalidatePath('/accounting');
}

// ── Clients ──────────────────────────────────────────────

export type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  niu: string | null;
  rccm: string | null;
  address: string | null;
  city: string | null;
  payment_terms_days: number;
  is_active: boolean;
};

const CUSTOMER_COLUMNS = 'id, name, contact_name, phone, email, niu, rccm, address, city, payment_terms_days, is_active';

export type CustomerWithBalance = Customer & { outstanding: number; overdue: number };

/** Clients du point avec leur reste dû (factures émises non réglées). */
export async function listCustomers(includeInactive = true): Promise<CustomerWithBalance[]> {
  const session = await requireInvoicing();
  if (!session) return [];
  const admin = getAdminSupabase();
  let query = admin.from('customers').select(CUSTOMER_COLUMNS).eq('structure_id', session.structureId).order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const [{ data: customers }, { data: invoices }] = await Promise.all([
    query,
    admin
      .from('sales_documents')
      .select('customer_id, total_ttc, amount_paid, amount_credited, due_date')
      .eq('structure_id', session.structureId)
      .eq('kind', 'INVOICE')
      .eq('status', 'ISSUED'),
  ]);
  const today = accountingDate();
  const balances = new Map<string, { outstanding: number; overdue: number }>();
  for (const inv of invoices || []) {
    const due = Math.max(0, Number(inv.total_ttc) - Number(inv.amount_paid) - Number(inv.amount_credited));
    if (!due) continue;
    const b = balances.get(inv.customer_id) ?? { outstanding: 0, overdue: 0 };
    b.outstanding += due;
    if (inv.due_date && inv.due_date < today) b.overdue += due;
    balances.set(inv.customer_id, b);
  }
  return ((customers || []) as Customer[]).map((c) => ({ ...c, ...(balances.get(c.id) ?? { outstanding: 0, overdue: 0 }) }));
}

export async function saveCustomer(input: {
  id?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  niu?: string;
  rccm?: string;
  address?: string;
  city?: string;
  paymentTermsDays?: number;
}): Promise<Result<{ id: string }>> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const name = String(input.name || '').trim();
  if (!name) return { success: false, error: await te('accounting.customers.errors.nameRequired') };
  const terms = Math.round(Number(input.paymentTermsDays ?? 30));
  const clean = (v?: string) => String(v ?? '').trim() || null;
  const payload = {
    name: name.slice(0, 150),
    contact_name: clean(input.contactName),
    phone: clean(input.phone),
    email: clean(input.email)?.toLowerCase() ?? null,
    niu: clean(input.niu)?.toUpperCase() ?? null,
    rccm: clean(input.rccm)?.toUpperCase() ?? null,
    address: clean(input.address),
    city: clean(input.city),
    payment_terms_days: Number.isFinite(terms) ? Math.min(365, Math.max(0, terms)) : 30,
  };
  const admin = getAdminSupabase();
  const query = input.id
    ? admin.from('customers').update(payload).eq('id', input.id).eq('structure_id', session.structureId).select('id').single()
    : admin.from('customers').insert({ ...payload, structure_id: session.structureId }).select('id').single();
  const { data, error } = await query;
  if (error || !data) return { success: false, error: await invoicingError(error) };
  revalidateInvoicing();
  return { success: true, data: { id: data.id as string } };
}

export async function setCustomerActive(id: string, isActive: boolean): Promise<Result> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { error } = await getAdminSupabase()
    .from('customers')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('structure_id', session.structureId);
  if (error) return { success: false, error: await invoicingError(error) };
  revalidateInvoicing();
  return { success: true };
}

// ── Liste des documents ──────────────────────────────────

export type SalesDocumentRow = {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  number: string | null;
  issue_date: string;
  due_date: string | null;
  subject: string | null;
  total_ttc: number;
  amount_paid: number;
  amount_credited: number;
  entry_id: string | null;
  customers: { name: string } | null;
};

export type SalesDocumentStats = {
  invoiced: number;
  collected: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  drafts: number;
  openQuotes: number;
};

const EMPTY_STATS: SalesDocumentStats = { invoiced: 0, collected: 0, outstanding: 0, overdue: 0, overdueCount: 0, drafts: 0, openQuotes: 0 };

/**
 * Documents du point, 20 par page (les plus récents d'abord). Filtres : type, état
 * (`unpaid`, `overdue`, ou un statut), recherche sur le numéro, l'objet ou le client.
 */
export async function listSalesDocuments(filters: {
  page?: number;
  kind?: string | null;
  state?: string | null;
  q?: string | null;
} = {}): Promise<Paginated<SalesDocumentRow, SalesDocumentStats>> {
  const page = Math.max(1, filters.page ?? 1);
  const session = await requireInvoicing();
  if (!session) return emptyPage(EMPTY_STATS, page);
  const admin = getAdminSupabase();
  const today = accountingDate();
  const [from, to] = pageRange(page);

  let query = admin
    .from('sales_documents')
    .select('id, kind, status, number, issue_date, due_date, subject, total_ttc, amount_paid, amount_credited, entry_id, customers!inner(name)', { count: 'exact' })
    .eq('structure_id', session.structureId)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (filters.kind && ['QUOTE', 'INVOICE', 'CREDIT_NOTE'].includes(filters.kind)) query = query.eq('kind', filters.kind);
  if (filters.state === 'unpaid' || filters.state === 'overdue') {
    query = query.eq('kind', 'INVOICE').eq('status', 'ISSUED').gt('remaining_due', 0);
    if (filters.state === 'overdue') query = query.lt('due_date', today);
  } else if (filters.state && ['DRAFT', 'ISSUED', 'ACCEPTED', 'REFUSED', 'CONVERTED', 'CANCELLED'].includes(filters.state)) {
    query = query.eq('status', filters.state);
  }
  const q = searchTerm(filters.q);
  if (q) {
    // Numéro, objet, ou nom du client (recherché d'abord parmi les clients du point)
    const { data: matching } = await admin.from('customers').select('id').eq('structure_id', session.structureId).ilike('name', `%${q}%`).limit(200);
    const ids = (matching ?? []).map((c) => c.id as string);
    query = query.or([`number.ilike.%${q}%`, `subject.ilike.%${q}%`, ...(ids.length ? [`customer_id.in.(${ids.join(',')})`] : [])].join(','));
  }

  const [{ data, count, error }, statsRes] = await Promise.all([
    settlePage(query),
    admin.rpc('sales_document_list_stats', { p_structure_id: session.structureId, p_today: today }),
  ]);
  if (error) console.error('[invoicing] liste :', error);
  const items = (data ?? []) as unknown as SalesDocumentRow[];
  const raw = (statsRes.data ?? EMPTY_STATS) as Partial<SalesDocumentStats>;
  const stats = Object.fromEntries(Object.keys(EMPTY_STATS).map((k) => [k, Number(raw[k as keyof SalesDocumentStats]) || 0])) as SalesDocumentStats;
  return { items, meta: buildMeta(page, count ?? 0, stats) };
}

// ── Un document ──────────────────────────────────────────

export type SalesDocumentLine = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  account: string;
  total_ht: number;
  tax_amount: number;
};

export type SalesPayment = { id: string; amount: number; payment_method: string; paid_at: string; reference: string | null; entry_id: string | null };

export type SalesDocument = SalesDocumentRow & {
  notes: string | null;
  subtotal_ht: number;
  tax_amount: number;
  customer_id: string;
  source_document_id: string | null;
  issued_at: string | null;
  customers: Customer;
  sales_document_lines: SalesDocumentLine[];
  sales_payments: SalesPayment[];
  /** Document d'origine (devis → facture, facture → avoir) et documents qui en découlent. */
  source: { id: string; kind: DocumentKind; number: string | null } | null;
  derived: { id: string; kind: DocumentKind; number: string | null; status: DocumentStatus; total_ttc: number }[];
};

export async function getSalesDocument(id: string): Promise<SalesDocument | null> {
  const session = await requireInvoicing();
  if (!session || !UUID_RE.test(id)) return null;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('sales_documents')
    .select(`*, customers(${CUSTOMER_COLUMNS}), sales_document_lines(*), sales_payments(id, amount, payment_method, paid_at, reference, entry_id)`)
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!data) return null;
  const [{ data: source }, { data: derived }] = await Promise.all([
    data.source_document_id
      ? admin.from('sales_documents').select('id, kind, number').eq('id', data.source_document_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('sales_documents')
      .select('id, kind, number, status, total_ttc')
      .eq('source_document_id', id)
      .order('created_at'),
  ]);
  const doc = data as unknown as SalesDocument;
  doc.sales_document_lines = [...(doc.sales_document_lines ?? [])].sort((a, b) => a.position - b.position);
  doc.sales_payments = [...(doc.sales_payments ?? [])].sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  doc.source = (source as SalesDocument['source']) ?? null;
  doc.derived = (derived ?? []) as SalesDocument['derived'];
  return doc;
}

/** Données du formulaire : clients actifs, TVA par défaut du point, délai de paiement. */
export async function getDocumentFormData() {
  const session = await requireInvoicing();
  if (!session) return null;
  const admin = getAdminSupabase();
  const [customers, { data: structure }] = await Promise.all([
    listCustomers(false),
    admin.from('structures').select('tax_rate').eq('id', session.structureId).maybeSingle(),
  ]);
  return { customers, defaultTaxRate: Number(structure?.tax_rate) || 0, today: accountingDate() };
}

// ── Brouillon : création et modification ─────────────────

export type DocumentDraftInput = {
  id?: string;
  kind: DocumentKind;
  customerId: string;
  issueDate: string;
  dueDate?: string | null;
  subject?: string;
  notes?: string;
  sourceDocumentId?: string | null;
  lines: { description: string; quantity: number; unitPrice: number; discountPercent?: number; taxRate: number; nature?: LineNature }[];
};

export async function saveSalesDocument(input: DocumentDraftInput): Promise<Result<{ id: string }>> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (!['QUOTE', 'INVOICE', 'CREDIT_NOTE'].includes(input.kind)) return { success: false, error: await te('errors.unexpected') };
  if (!DATE_RE.test(input.issueDate)) return { success: false, error: await te('accounting.errors.invalidDate') };
  if (input.dueDate && (!DATE_RE.test(input.dueDate) || input.dueDate < input.issueDate)) {
    return { success: false, error: await te('accounting.invoices.errors.dueDate') };
  }

  const lines: LineInput[] = (Array.isArray(input.lines) ? input.lines : [])
    .slice(0, MAX_LINES)
    .map((l) => ({
      description: String(l.description ?? '').trim().slice(0, 500),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountPercent: Number(l.discountPercent) || 0,
      taxRate: Number(l.taxRate) || 0,
      nature: LINE_NATURE_KEYS.includes(l.nature as LineNature) ? (l.nature as LineNature) : 'services',
    }))
    .filter((l) => l.description);
  if (!lines.length) return { success: false, error: await te('accounting.invoices.errors.noLines') };
  if (lines.some((l) => !(l.quantity > 0) || !(l.unitPrice >= 0) || l.taxRate < 0 || l.taxRate > 100)) {
    return { success: false, error: await te('accounting.invoices.errors.invalidLine') };
  }

  const admin = getAdminSupabase();
  const { data: customer } = await admin
    .from('customers')
    .select('id, payment_terms_days')
    .eq('id', input.customerId)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!customer) return { success: false, error: await te('accounting.invoices.errors.customerRequired') };

  if (input.id) {
    const { data: existing } = await admin.from('sales_documents').select('status').eq('id', input.id).eq('structure_id', session.structureId).maybeSingle();
    if (!existing) return { success: false, error: await te('errors.unexpected') };
    if (existing.status !== 'DRAFT') return { success: false, error: await te('accounting.invoices.errors.notDraft') };
  }

  const totals = computeDocumentTotals(lines);
  const dueDate =
    input.kind === 'CREDIT_NOTE' ? null : input.dueDate || dueDateFrom(input.issueDate, Number(customer.payment_terms_days) || 0);
  const payload = {
    customer_id: customer.id,
    kind: input.kind,
    issue_date: input.issueDate,
    due_date: dueDate,
    subject: String(input.subject ?? '').trim().slice(0, 200) || null,
    notes: String(input.notes ?? '').trim().slice(0, 2000) || null,
    subtotal_ht: totals.subtotalHt,
    tax_amount: totals.taxAmount,
    total_ttc: totals.totalTtc,
    updated_at: new Date().toISOString(),
  };

  let id = input.id;
  if (id) {
    const { error } = await admin.from('sales_documents').update(payload).eq('id', id).eq('structure_id', session.structureId).eq('status', 'DRAFT');
    if (error) return { success: false, error: await invoicingError(error) };
    await admin.from('sales_document_lines').delete().eq('document_id', id);
  } else {
    let sourceId: string | null = null;
    if (input.sourceDocumentId && UUID_RE.test(input.sourceDocumentId)) {
      const { data: src } = await admin.from('sales_documents').select('id').eq('id', input.sourceDocumentId).eq('structure_id', session.structureId).maybeSingle();
      sourceId = (src?.id as string) ?? null;
    }
    const { data, error } = await admin
      .from('sales_documents')
      .insert({ ...payload, structure_id: session.structureId, status: 'DRAFT', source_document_id: sourceId, created_by: session.userId })
      .select('id')
      .single();
    if (error || !data) return { success: false, error: await invoicingError(error) };
    id = data.id as string;
  }

  const { error: linesError } = await admin.from('sales_document_lines').insert(
    totals.lines.map((l, position) => ({
      document_id: id,
      position,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      discount_percent: l.discountPercent ?? 0,
      tax_rate: l.taxRate,
      account: l.account,
      total_ht: l.totalHt,
      tax_amount: l.taxAmount,
    }))
  );
  if (linesError) return { success: false, error: await invoicingError(linesError) };
  revalidateInvoicing(id);
  return { success: true, data: { id: id! } };
}

// ── Cycle de vie ─────────────────────────────────────────

/**
 * Valide un brouillon : numéro définitif, document figé. Une facture ou un avoir est
 * comptabilisé dans la foulée (journal des ventes).
 */
export async function issueSalesDocument(id: string): Promise<Result<{ number: string; accountingWarning?: string }>> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data: doc } = await admin
    .from('sales_documents')
    .select('id, kind, status, issue_date, structures(accounting_locked_until)')
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!doc) return { success: false, error: await te('errors.unexpected') };
  if (doc.status !== 'DRAFT') return { success: false, error: await te('accounting.invoices.errors.notDraft') };
  const structure = (Array.isArray(doc.structures) ? doc.structures[0] : doc.structures) as { accounting_locked_until?: string | null } | null;
  if (doc.kind !== 'QUOTE' && structure?.accounting_locked_until && doc.issue_date <= structure.accounting_locked_until) {
    return { success: false, error: await te('accounting.errors.periodLocked') };
  }

  const { data: number, error } = await admin.rpc('issue_sales_document', { p_id: id });
  if (error || !number) return { success: false, error: await invoicingError(error) };

  let accountingWarning: string | undefined;
  if (doc.kind !== 'QUOTE') {
    try {
      const entryId = await postSalesDocument(id, session.userId);
      if (entryId) await admin.from('sales_documents').update({ entry_id: entryId }).eq('id', id);
    } catch (postError) {
      console.error('[invoicing] comptabilisation :', postError);
      accountingWarning = await te('accounting.invoices.errors.postingFailed');
    }
  }
  revalidateInvoicing(id);
  return { success: true, data: { number: number as string, accountingWarning } };
}

/** Nouvel essai de comptabilisation d'un document émis sans écriture (période verrouillée, erreur…). */
export async function postMissingDocumentEntry(id: string): Promise<Result> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data: doc } = await admin.from('sales_documents').select('id, entry_id').eq('id', id).eq('structure_id', session.structureId).maybeSingle();
  if (!doc) return { success: false, error: await te('errors.unexpected') };
  try {
    const entryId = doc.entry_id ?? (await postSalesDocument(id, session.userId));
    if (entryId) await admin.from('sales_documents').update({ entry_id: entryId }).eq('id', id);
    // Encaissements restés sans écriture
    const { data: payments } = await admin.from('sales_payments').select('id').eq('document_id', id).is('entry_id', null);
    for (const p of payments || []) {
      const paymentEntry = await postSalesPayment(p.id as string, session.userId);
      if (paymentEntry) await admin.from('sales_payments').update({ entry_id: paymentEntry }).eq('id', p.id);
    }
  } catch (error) {
    return { success: false, error: await invoicingError(error) };
  }
  revalidateInvoicing(id);
  return { success: true };
}

export async function recordSalesPayment(input: {
  documentId: string;
  amount: number;
  method: string;
  paidAt: string;
  reference?: string;
  /** Banque ou compte Mobile Money qui reçoit (sinon compte par défaut du moyen de paiement). */
  bankAccountId?: string | null;
}): Promise<Result<{ accountingWarning?: string }>> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const amount = Math.round(Number(input.amount));
  if (!(amount > 0)) return { success: false, error: await te('accounting.invoices.errors.amount') };
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) return { success: false, error: await te('errors.unexpected') };
  if (!DATE_RE.test(input.paidAt)) return { success: false, error: await te('accounting.errors.invalidDate') };

  const admin = getAdminSupabase();
  const { data: doc } = await admin
    .from('sales_documents')
    .select('id, issue_date, structures(accounting_locked_until)')
    .eq('id', input.documentId)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!doc) return { success: false, error: await te('errors.unexpected') };
  if (input.paidAt < doc.issue_date) return { success: false, error: await te('accounting.invoices.errors.paymentBeforeInvoice') };
  const structure = (Array.isArray(doc.structures) ? doc.structures[0] : doc.structures) as { accounting_locked_until?: string | null } | null;
  if (structure?.accounting_locked_until && input.paidAt <= structure.accounting_locked_until) {
    return { success: false, error: await te('accounting.errors.periodLocked') };
  }

  const { data: paymentId, error } = await admin.rpc('record_sales_payment', {
    p_document_id: input.documentId,
    p_amount: amount,
    p_method: input.method,
    p_paid_at: input.paidAt,
    p_reference: String(input.reference ?? '').trim().slice(0, 120) || null,
    p_created_by: session.userId,
  });
  if (error || !paymentId) return { success: false, error: await invoicingError(error) };
  const treasury = await bankAccountNumber(session.structureId, input.bankAccountId);
  if (treasury) await admin.from('sales_payments').update({ treasury_account: treasury }).eq('id', paymentId);

  let accountingWarning: string | undefined;
  try {
    const entryId = await postSalesPayment(paymentId as string, session.userId);
    if (entryId) await admin.from('sales_payments').update({ entry_id: entryId }).eq('id', paymentId);
  } catch (postError) {
    console.error('[invoicing] comptabilisation de l’encaissement :', postError);
    accountingWarning = await te('accounting.invoices.errors.postingFailed');
  }
  revalidateInvoicing(input.documentId);
  return { success: true, data: { accountingWarning } };
}

/** Devis : accepté ou refusé par le client. */
export async function setQuoteOutcome(id: string, outcome: 'ACCEPTED' | 'REFUSED'): Promise<Result> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (outcome !== 'ACCEPTED' && outcome !== 'REFUSED') return { success: false, error: await te('errors.unexpected') };
  const { data, error } = await getAdminSupabase()
    .from('sales_documents')
    .update({ status: outcome, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .eq('kind', 'QUOTE')
    .in('status', ['ISSUED', 'ACCEPTED', 'REFUSED'])
    .select('id');
  if (error || !data?.length) return { success: false, error: await invoicingError(error) };
  revalidateInvoicing(id);
  return { success: true };
}

/** Copie d'un document en nouveau brouillon (devis → facture, facture → avoir). */
async function copyAsDraft(sourceId: string, kind: 'INVOICE' | 'CREDIT_NOTE'): Promise<Result<{ id: string }>> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const source = await getSalesDocument(sourceId);
  if (!source) return { success: false, error: await te('errors.unexpected') };
  const allowed =
    kind === 'INVOICE'
      ? source.kind === 'QUOTE' && ['ISSUED', 'ACCEPTED'].includes(source.status)
      : source.kind === 'INVOICE' && source.status === 'ISSUED';
  if (!allowed) return { success: false, error: await te('accounting.invoices.errors.notAllowed') };

  const result = await saveSalesDocument({
    kind,
    customerId: source.customer_id,
    issueDate: accountingDate(),
    subject: source.subject ?? undefined,
    notes: kind === 'CREDIT_NOTE' ? undefined : source.notes ?? undefined,
    sourceDocumentId: source.id,
    lines: source.sales_document_lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      discountPercent: Number(l.discount_percent),
      taxRate: Number(l.tax_rate),
      nature: natureOfAccount(l.account),
    })),
  });
  if (!result.success) return result;
  if (kind === 'INVOICE') {
    await getAdminSupabase().from('sales_documents').update({ status: 'CONVERTED', updated_at: new Date().toISOString() }).eq('id', source.id);
    revalidateInvoicing(source.id);
  }
  return result;
}

export async function convertQuoteToInvoice(quoteId: string) {
  return copyAsDraft(quoteId, 'INVOICE');
}

export async function createCreditNote(invoiceId: string) {
  return copyAsDraft(invoiceId, 'CREDIT_NOTE');
}

/** Brouillon abandonné : supprimé (aucun numéro n'a été consommé). */
export async function deleteDraft(id: string): Promise<Result> {
  const session = await requireInvoicing();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('sales_documents')
    .delete()
    .eq('id', id)
    .eq('structure_id', session.structureId)
    .eq('status', 'DRAFT')
    .select('id, kind, source_document_id');
  if (error || !data?.length) return { success: false, error: await invoicingError(error ?? 'SALES_DOCUMENT_NOT_DRAFT') };
  // Facture brouillon issue d'un devis : le devis redevient « accepté »
  const deleted = data[0] as { kind: string; source_document_id: string | null };
  if (deleted.kind === 'INVOICE' && deleted.source_document_id) {
    await admin.from('sales_documents').update({ status: 'ACCEPTED' }).eq('id', deleted.source_document_id).eq('status', 'CONVERTED');
  }
  revalidateInvoicing();
  return { success: true };
}
