'use server';

import { revalidatePath } from 'next/cache';
import { getSession, type SessionPayload } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { getLocale, te } from '@/lib/i18n/server';
import { buildChart, type AccountLabel } from '@/lib/accounting/chart';
import {
  EXPENSE_CATEGORIES,
  JOURNALS,
  PAYMENT_METHODS,
  isExpenseCategory,
  type Journal,
} from '@/lib/accounting/mapping';
import {
  AccountingError,
  accountingDate,
  postBookingSale,
  postEntry,
  postExpense,
  postExpensePayment,
  postOrderSale,
  reverseEntry,
  type EntryLine,
} from '@/lib/accounting/posting';
import type { LedgerLine } from '@/lib/accounting/reports';
import { buildMeta, pageRange, settlePage } from '@/lib/pagination';
import {
  ACCOUNTING_MODULE,
  canPostEntries,
  canRecordExpenses,
  canViewReports,
} from '@/lib/accounting/permissions';

// ─────────────────────────────────────────────────────────
// Comptabilité SYSCOHADA (docs/phase12-accounting.sql)
//
// Portée :
// - rôles d'un point (ADMIN, COMPTABLE, MANAGER) : leur point ;
// - ORG_ADMIN : tous les points de son organisation (lecture seule), ou un
//   seul via le filtre `point`.
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

export type AccountingScope = {
  role: string;
  userId: string;
  /** Point courant pour les rôles d'un point ; null pour l'organisation. */
  structureId: string | null;
  structureIds: string[];
  points: { id: string; name: string }[];
  pointId: string | null;
  canPost: boolean;
  canExpense: boolean;
  canReports: boolean;
  lockedUntil: string | null;
};

async function getScope(pointId?: string | null): Promise<AccountingScope | null> {
  const session = await getSession();
  if (!session || !session.modules?.includes(ACCOUNTING_MODULE)) return null;
  const admin = getAdminSupabase();

  if (session.role === 'ORG_ADMIN' && session.organizationId) {
    const { data } = await admin
      .from('structures')
      .select('id, name')
      .eq('organization_id', session.organizationId)
      .order('name');
    const points = (data || []) as { id: string; name: string }[];
    const selected = pointId && points.some((p) => p.id === pointId) ? pointId : null;
    return {
      role: session.role,
      userId: session.userId,
      structureId: null,
      structureIds: selected ? [selected] : points.map((p) => p.id),
      points,
      pointId: selected,
      canPost: false,
      canExpense: false,
      canReports: true,
      lockedUntil: null,
    };
  }

  if (!session.structureId || !canRecordExpenses(session.role)) return null;
  const { data: structure } = await admin
    .from('structures')
    .select('*')
    .eq('id', session.structureId)
    .maybeSingle();
  return {
    role: session.role,
    userId: session.userId,
    structureId: session.structureId,
    structureIds: [session.structureId],
    points: [],
    pointId: null,
    canPost: canPostEntries(session.role),
    canExpense: canRecordExpenses(session.role),
    canReports: canViewReports(session.role),
    lockedUntil: (structure?.accounting_locked_until as string | null) ?? null,
  };
}

/** Portée pour une page (null si le rôle ou la licence ne le permet pas). */
export async function getAccountingScope(pointId?: string | null) {
  return getScope(pointId);
}

async function errorMessage(error: unknown) {
  if (error instanceof AccountingError) {
    switch (error.code) {
      case 'PERIOD_LOCKED':
        return te('accounting.errors.periodLocked');
      case 'UNBALANCED':
        return te('accounting.errors.unbalanced');
      case 'INVALID_LINES':
        return te('accounting.errors.invalidLines');
      case 'NOT_INSTALLED':
        return te('accounting.errors.notInstalled');
    }
  }
  console.error('[accounting]', error);
  return te('errors.unexpected');
}

/** Période par défaut : du 1er du mois à aujourd'hui. */
export async function resolvePeriod(from?: string | null, to?: string | null) {
  const today = accountingDate();
  const end = to && DATE_RE.test(to) ? to : today;
  const start = from && DATE_RE.test(from) && from <= end ? from : `${end.slice(0, 7)}-01`;
  return { from: start, to: end };
}

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Toutes les lignes des points jusqu'à `to` (les soldes d'ouverture en ont besoin). */
async function loadLines(structureIds: string[], to: string): Promise<LedgerLine[]> {
  if (!structureIds.length) return [];
  const admin = getAdminSupabase();
  return fetchAll<LedgerLine>((a, b) =>
    admin
      .from('accounting_lines')
      .select('id, entry_id, structure_id, journal, entry_date, account, label, debit, credit')
      .in('structure_id', structureIds)
      .lte('entry_date', to)
      .order('entry_date')
      .order('id')
      .range(a, b)
  ).then((rows) => rows.map((l) => ({ ...l, debit: Number(l.debit), credit: Number(l.credit) })));
}

async function loadChart(structureIds: string[]): Promise<AccountLabel[]> {
  const locale = await getLocale();
  if (!structureIds.length) return buildChart(locale);
  const { data } = await getAdminSupabase()
    .from('accounting_accounts')
    .select('number, label')
    .in('structure_id', structureIds);
  return buildChart(locale, data || []);
}

// ── Données des états ────────────────────────────────────

export async function getAccountingData(params: { point?: string | null; from?: string | null; to?: string | null }) {
  const scope = await getScope(params.point);
  if (!scope || !scope.canReports) return null;
  const period = await resolvePeriod(params.from, params.to);
  try {
    const [lines, chart] = await Promise.all([loadLines(scope.structureIds, period.to), loadChart(scope.structureIds)]);
    return { scope, period, lines, chart, installed: true as const };
  } catch (error) {
    console.error('[accounting] lecture des écritures :', error);
    return { scope, period, lines: [] as LedgerLine[], chart: await loadChart([]), installed: false as const };
  }
}

/** Ventes payées de la période qui n'ont pas encore leur écriture. */
async function findMissingSales(structureIds: string[], from: string, to: string) {
  const admin = getAdminSupabase();
  const start = `${from}T00:00:00+01:00`;
  const end = `${to}T23:59:59+01:00`;
  const orders = await fetchAll<{ id: string }>((a, b) =>
    admin
      .from('orders')
      .select('id')
      .in('structure_id', structureIds)
      .eq('status', 'COMPLETED')
      .gte('paid_at', start)
      .lte('paid_at', end)
      .range(a, b)
  );
  const { data: rooms } = await admin.from('rooms').select('id').in('structure_id', structureIds);
  const roomIds = (rooms || []).map((r) => r.id);
  const bookings = roomIds.length
    ? await fetchAll<{ id: string }>((a, b) =>
        admin
          .from('bookings')
          .select('id')
          .in('room_id', roomIds)
          .or('is_paid.eq.true,status.eq.COMPLETED')
          .gte('updated_at', start)
          .lte('updated_at', end)
          .range(a, b)
      )
    : [];

  const ids = [...orders.map((o) => o.id), ...bookings.map((b) => b.id)];
  const posted = new Set<string>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await admin
      .from('accounting_entries')
      .select('source_id')
      .in('source_type', ['ORDER', 'BOOKING'])
      .in('source_id', ids.slice(i, i + 150));
    for (const e of data || []) posted.add(e.source_id as string);
  }
  return {
    orders: orders.map((o) => o.id).filter((id) => !posted.has(id)),
    bookings: bookings.map((b) => b.id).filter((id) => !posted.has(id)),
  };
}

export async function getMissingSalesCount(params: { from: string; to: string }) {
  const scope = await getScope();
  if (!scope?.canPost || !scope.structureId) return 0;
  try {
    const missing = await findMissingSales([scope.structureId], params.from, params.to);
    return missing.orders.length + missing.bookings.length;
  } catch {
    return 0;
  }
}

/** Génère les écritures des ventes payées de la période qui n'en ont pas. */
export async function generateMissingEntries(from: string, to: string): Promise<Result<{ created: number; failed: number }>> {
  const scope = await getScope();
  if (!scope?.canPost || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { success: false, error: await te('accounting.errors.invalidPeriod') };
  try {
    const missing = await findMissingSales([scope.structureId], from, to);
    let created = 0;
    let failed = 0;
    for (const id of missing.orders) {
      try {
        if (await postOrderSale(id, { force: true })) created++;
      } catch {
        failed++;
      }
    }
    for (const id of missing.bookings) {
      try {
        if (await postBookingSale(id, { force: true })) created++;
      } catch {
        failed++;
      }
    }
    revalidatePath('/accounting', 'layout');
    return { success: true, data: { created, failed } };
  } catch (error) {
    return { success: false, error: await errorMessage(error) };
  }
}

// ── Journal ──────────────────────────────────────────────

export type JournalEntry = {
  id: string;
  structure_id: string;
  journal: string;
  number: string;
  entry_date: string;
  label: string;
  reference: string | null;
  source_type: string;
  reversal_of: string | null;
  reversed: boolean;
  lines: { account: string; label: string; debit: number; credit: number }[];
};

export async function getJournalEntries(params: {
  point?: string | null;
  from?: string | null;
  to?: string | null;
  journal?: string | null;
  /** Page de 20 écritures ; absent : toute la période (export). */
  page?: number;
}) {
  const scope = await getScope(params.point);
  if (!scope || !scope.canReports) return null;
  const period = await resolvePeriod(params.from, params.to);
  const journal = JOURNALS.includes(params.journal as Journal) ? (params.journal as Journal) : null;
  const admin = getAdminSupabase();
  try {
    const entriesQuery = (count = false) => {
      let q = admin
        .from('accounting_entries')
        .select('id, structure_id, journal, number, entry_date, label, reference, source_type, reversal_of', count ? { count: 'exact' } : undefined)
        .in('structure_id', scope.structureIds)
        .gte('entry_date', period.from)
        .lte('entry_date', period.to);
      if (journal) q = q.eq('journal', journal);
      return q.order('entry_date', { ascending: false }).order('number', { ascending: false }).order('id', { ascending: false });
    };
    // Écran : une page de 20 écritures avec le total ; export : toute la période, par tranches.
    const page = params.page ? Math.max(1, params.page) : null;
    let entries: Omit<JournalEntry, 'lines' | 'reversed'>[];
    let total: number;
    if (page) {
      const [from, to] = pageRange(page);
      const { data, count, error } = await settlePage(entriesQuery(true).range(from, to));
      if (error) throw error;
      entries = (data ?? []) as Omit<JournalEntry, 'lines' | 'reversed'>[];
      total = count ?? 0;
    } else {
      entries = await fetchAll<Omit<JournalEntry, 'lines' | 'reversed'>>((a, b) => entriesQuery().range(a, b));
      total = entries.length;
    }
    const ids = entries.map((e) => e.id);
    const lines: (JournalEntry['lines'][number] & { entry_id: string })[] = [];
    const reversed = new Set<string>();
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      const { data } = await admin
        .from('accounting_lines')
        .select('entry_id, account, label, debit, credit')
        .in('entry_id', chunk);
      lines.push(...(data || []).map((l) => ({ ...l, debit: Number(l.debit), credit: Number(l.credit) })));
      const { data: reversals } = await admin.from('accounting_entries').select('reversal_of').in('reversal_of', chunk);
      for (const r of reversals || []) reversed.add(r.reversal_of as string);
    }
    const byEntry = new Map<string, JournalEntry['lines']>();
    for (const l of lines) {
      const list = byEntry.get(l.entry_id) ?? [];
      list.push({ account: l.account, label: l.label, debit: l.debit, credit: l.credit });
      byEntry.set(l.entry_id, list);
    }
    const result: JournalEntry[] = entries.map((e) => ({
      ...e,
      reversed: reversed.has(e.id),
      lines: (byEntry.get(e.id) ?? []).sort((a, b) => b.debit - a.debit),
    }));
    return { scope, period, journal, entries: result, meta: buildMeta(page ?? 1, total, undefined), chart: await loadChart(scope.structureIds), installed: true as const };
  } catch (error) {
    console.error('[accounting] journal :', error);
    return { scope, period, journal, entries: [] as JournalEntry[], meta: buildMeta(1, 0, undefined), chart: await loadChart([]), installed: false as const };
  }
}

export async function createManualEntry(input: {
  journal: string;
  date: string;
  label: string;
  reference?: string;
  lines: { account: string; label?: string; debit: number; credit: number }[];
}): Promise<Result<{ id: string }>> {
  const scope = await getScope();
  if (!scope?.canPost || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  const journal = input.journal as Journal;
  if (!JOURNALS.includes(journal) || journal === 'VE') {
    return { success: false, error: await te('accounting.errors.invalidJournal') };
  }
  if (!DATE_RE.test(input.date)) return { success: false, error: await te('accounting.errors.invalidPeriod') };
  const label = String(input.label || '').trim();
  if (!label) return { success: false, error: await te('accounting.errors.labelRequired') };

  const chart = await loadChart([scope.structureId]);
  const known = new Set(chart.map((a) => a.number));
  const lines: EntryLine[] = [];
  for (const l of input.lines || []) {
    const account = String(l.account || '').trim();
    const debit = Math.round((Number(l.debit) || 0) * 100) / 100;
    const credit = Math.round((Number(l.credit) || 0) * 100) / 100;
    if (!debit && !credit) continue;
    if (!known.has(account)) return { success: false, error: await te('accounting.errors.unknownAccount', { account }) };
    if (debit < 0 || credit < 0 || (debit && credit)) return { success: false, error: await te('accounting.errors.invalidLines') };
    lines.push({ account, label: String(l.label || '').trim() || label, debit, credit });
  }
  const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (lines.length < 2) return { success: false, error: await te('accounting.errors.invalidLines') };
  if (Math.abs(totalDebit - totalCredit) > 0.001) return { success: false, error: await te('accounting.errors.unbalanced') };

  try {
    const id = await postEntry({
      structureId: scope.structureId,
      journal,
      date: input.date,
      label: label.slice(0, 250),
      reference: input.reference?.trim() || null,
      createdBy: scope.userId,
      lines,
    });
    revalidatePath('/accounting', 'layout');
    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: await errorMessage(error) };
  }
}

export async function reverseAccountingEntry(entryId: string, reason?: string): Promise<Result> {
  const scope = await getScope();
  if (!scope?.canPost || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data: entry } = await admin
    .from('accounting_entries')
    .select('id, structure_id, source_type')
    .eq('id', entryId)
    .eq('structure_id', scope.structureId)
    .maybeSingle();
  if (!entry) return { success: false, error: await te('accounting.errors.entryNotFound') };
  if (entry.source_type === 'REVERSAL') return { success: false, error: await te('accounting.errors.cannotReverseReversal') };
  try {
    await reverseEntry(entryId, { createdBy: scope.userId, reason: reason?.trim() || undefined });
    revalidatePath('/accounting', 'layout');
    return { success: true };
  } catch (error) {
    return { success: false, error: await errorMessage(error) };
  }
}

// ── Plan comptable ───────────────────────────────────────

export async function getChartOfAccounts() {
  const scope = await getScope();
  if (!scope) return null;
  return { scope, chart: await loadChart(scope.structureIds) };
}

export async function addCustomAccount(number: string, label: string): Promise<Result> {
  const scope = await getScope();
  if (!scope?.canPost || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  const cleanNumber = String(number || '').trim();
  const cleanLabel = String(label || '').trim();
  if (!/^[1-8][0-9]{2,11}$/.test(cleanNumber)) return { success: false, error: await te('accounting.errors.invalidAccountNumber') };
  if (!cleanLabel) return { success: false, error: await te('accounting.errors.labelRequired') };
  const chart = await loadChart([scope.structureId]);
  if (chart.some((a) => a.number === cleanNumber)) return { success: false, error: await te('accounting.errors.accountExists') };
  if (!chart.some((a) => cleanNumber.startsWith(a.number) && a.number !== cleanNumber)) {
    return { success: false, error: await te('accounting.errors.noParentAccount') };
  }
  const { error } = await getAdminSupabase()
    .from('accounting_accounts')
    .insert({ structure_id: scope.structureId, number: cleanNumber, label: cleanLabel.slice(0, 120) });
  if (error) return { success: false, error: await errorMessage(error) };
  revalidatePath('/accounting/accounts');
  return { success: true };
}

// ── Clôture ──────────────────────────────────────────────

export async function setAccountingLock(date: string | null): Promise<Result> {
  const scope = await getScope();
  if (!scope?.canPost || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  if (date && !DATE_RE.test(date)) return { success: false, error: await te('accounting.errors.invalidPeriod') };
  // Une clôture ne peut être levée que par l'administrateur du point.
  if (scope.lockedUntil && (!date || date < scope.lockedUntil) && scope.role !== 'ADMIN') {
    return { success: false, error: await te('accounting.errors.unlockAdminOnly') };
  }
  const { error } = await getAdminSupabase()
    .from('structures')
    .update({ accounting_locked_until: date })
    .eq('id', scope.structureId);
  if (error) return { success: false, error: await errorMessage(error) };
  revalidatePath('/accounting', 'layout');
  return { success: true };
}

// ── Fournisseurs ─────────────────────────────────────────

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  niu: string | null;
  address: string | null;
  is_active: boolean;
};

export async function getSuppliers(includeInactive = false) {
  const scope = await getScope();
  if (!scope?.structureId) return [];
  let q = getAdminSupabase()
    .from('suppliers')
    .select('id, name, phone, email, niu, address, is_active')
    .eq('structure_id', scope.structureId)
    .order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data } = await q;
  return (data || []) as Supplier[];
}

export async function saveSupplier(input: {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  niu?: string;
  address?: string;
}): Promise<Result<{ id: string }>> {
  const scope = await getScope();
  if (!scope?.canExpense || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  const name = String(input.name || '').trim();
  if (!name) return { success: false, error: await te('accounting.errors.supplierNameRequired') };
  const payload = {
    name: name.slice(0, 150),
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    niu: input.niu?.trim().toUpperCase() || null,
    address: input.address?.trim() || null,
  };
  const admin = getAdminSupabase();
  const query = input.id
    ? admin.from('suppliers').update(payload).eq('id', input.id).eq('structure_id', scope.structureId).select('id').single()
    : admin.from('suppliers').insert({ ...payload, structure_id: scope.structureId }).select('id').single();
  const { data, error } = await query;
  if (error || !data) return { success: false, error: await errorMessage(error) };
  revalidatePath('/accounting/suppliers');
  return { success: true, data: { id: data.id } };
}

export async function setSupplierActive(id: string, isActive: boolean): Promise<Result> {
  const scope = await getScope();
  if (!scope?.canExpense || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  const { error } = await getAdminSupabase()
    .from('suppliers')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('structure_id', scope.structureId);
  if (error) return { success: false, error: await errorMessage(error) };
  revalidatePath('/accounting/suppliers');
  return { success: true };
}

// ── Dépenses ─────────────────────────────────────────────

export type Expense = {
  id: string;
  supplier_id: string | null;
  category: string;
  account: string;
  expense_date: string;
  label: string;
  reference: string | null;
  amount_ht: number;
  tax_amount: number;
  amount_ttc: number;
  status: 'UNPAID' | 'PAID' | 'CANCELLED';
  payment_method: string | null;
  paid_at: string | null;
  attachment_url: string | null;
  suppliers: { name: string } | null;
};

export type ExpenseListStats = { count: number; total: number; unpaidTotal: number };

/** Dépenses du point sur la période, 20 par page ; totaux de la période et dettes non réglées en SQL. */
export async function getExpenses(params: { from?: string | null; to?: string | null; status?: string | null; page?: number }) {
  const scope = await getScope();
  if (!scope?.canExpense || !scope.structureId) return null;
  const period = await resolvePeriod(params.from, params.to);
  const admin = getAdminSupabase();
  const page = Math.max(1, params.page ?? 1);
  const emptyStats: ExpenseListStats = { count: 0, total: 0, unpaidTotal: 0 };
  try {
    const status = params.status && ['UNPAID', 'PAID', 'CANCELLED'].includes(params.status) ? params.status : null;
    const [from, to] = pageRange(page);
    let q = admin
      .from('expenses')
      .select('*, suppliers(name)', { count: 'exact' })
      .eq('structure_id', scope.structureId)
      .gte('expense_date', period.from)
      .lte('expense_date', period.to);
    if (status) q = q.eq('status', status);
    const [{ data, count, error }, statsRes] = await Promise.all([
      settlePage(q.order('expense_date', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      admin.rpc('expense_list_stats', { p_structure_id: scope.structureId, p_from: period.from, p_to: period.to, p_status: status }),
    ]);
    if (error) throw error;
    const raw = (statsRes.data ?? emptyStats) as ExpenseListStats;
    const stats: ExpenseListStats = { count: Number(raw.count) || 0, total: Number(raw.total) || 0, unpaidTotal: Number(raw.unpaidTotal) || 0 };
    return {
      scope,
      period,
      expenses: (data ?? []) as Expense[],
      meta: buildMeta(page, count ?? 0, stats),
      unpaidTotal: stats.unpaidTotal,
      suppliers: await getSuppliers(),
      installed: true as const,
    };
  } catch (error) {
    console.error('[accounting] dépenses :', error);
    return { scope, period, expenses: [] as Expense[], meta: buildMeta(page, 0, emptyStats), unpaidTotal: 0, suppliers: [] as Supplier[], installed: false as const };
  }
}

function isPaymentMethod(value: string) {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export async function createExpense(input: {
  category: string;
  label: string;
  supplierId?: string | null;
  date: string;
  reference?: string;
  amountTtc: number;
  taxAmount?: number;
  paid: boolean;
  paymentMethod?: string | null;
  attachmentUrl?: string | null;
}): Promise<Result<{ id: string }>> {
  const scope = await getScope();
  if (!scope?.canExpense || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  if (!isExpenseCategory(input.category)) return { success: false, error: await te('accounting.errors.invalidCategory') };
  const category = EXPENSE_CATEGORIES[input.category];
  const label = String(input.label || '').trim();
  if (!label) return { success: false, error: await te('accounting.errors.labelRequired') };
  if (!DATE_RE.test(input.date) || input.date > accountingDate()) {
    return { success: false, error: await te('accounting.errors.invalidDate') };
  }
  const ttc = Math.round(Number(input.amountTtc) || 0);
  const tax = category.vat ? Math.round(Number(input.taxAmount) || 0) : 0;
  if (ttc <= 0) return { success: false, error: await te('accounting.errors.invalidAmount') };
  if (tax < 0 || tax >= ttc) return { success: false, error: await te('accounting.errors.invalidTax') };
  if (input.paid && !isPaymentMethod(String(input.paymentMethod))) {
    return { success: false, error: await te('accounting.errors.paymentMethodRequired') };
  }
  if (scope.lockedUntil && input.date <= scope.lockedUntil) {
    return { success: false, error: await te('accounting.errors.periodLocked') };
  }

  const admin = getAdminSupabase();
  let supplierId: string | null = null;
  if (input.supplierId) {
    const { data: supplier } = await admin
      .from('suppliers')
      .select('id')
      .eq('id', input.supplierId)
      .eq('structure_id', scope.structureId)
      .maybeSingle();
    supplierId = supplier?.id ?? null;
  }

  const { data: expense, error } = await admin
    .from('expenses')
    .insert({
      structure_id: scope.structureId,
      supplier_id: supplierId,
      category: input.category,
      account: category.account,
      expense_date: input.date,
      label: label.slice(0, 250),
      reference: input.reference?.trim() || null,
      amount_ht: ttc - tax,
      tax_amount: tax,
      amount_ttc: ttc,
      status: input.paid ? 'PAID' : 'UNPAID',
      payment_method: input.paid ? input.paymentMethod : null,
      paid_at: input.paid ? input.date : null,
      attachment_url: input.attachmentUrl || null,
      created_by: scope.userId,
    })
    .select('*')
    .single();
  if (error || !expense) return { success: false, error: await errorMessage(error) };

  try {
    const entryId = await postExpense(expense, scope.userId);
    const update: Record<string, string> = { entry_id: entryId };
    if (input.paid) update.payment_entry_id = await postExpensePayment(expense, scope.userId);
    await admin.from('expenses').update(update).eq('id', expense.id);
  } catch (postError) {
    // Pas de dépense sans écriture : on annule la saisie.
    await admin.from('expenses').delete().eq('id', expense.id);
    return { success: false, error: await errorMessage(postError) };
  }
  revalidatePath('/accounting', 'layout');
  return { success: true, data: { id: expense.id } };
}

export async function payExpense(id: string, paymentMethod: string, date: string): Promise<Result> {
  const scope = await getScope();
  if (!scope?.canExpense || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  if (!isPaymentMethod(paymentMethod)) return { success: false, error: await te('accounting.errors.paymentMethodRequired') };
  if (!DATE_RE.test(date) || date > accountingDate()) return { success: false, error: await te('accounting.errors.invalidDate') };
  const admin = getAdminSupabase();
  const { data: expense } = await admin
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('structure_id', scope.structureId)
    .maybeSingle();
  if (!expense) return { success: false, error: await te('accounting.errors.expenseNotFound') };
  if (expense.status !== 'UNPAID') return { success: false, error: await te('accounting.errors.expenseNotUnpaid') };
  if (date < expense.expense_date) return { success: false, error: await te('accounting.errors.invalidDate') };
  try {
    const paymentEntryId = await postExpensePayment({ ...expense, payment_method: paymentMethod, paid_at: date }, scope.userId);
    await admin
      .from('expenses')
      .update({ status: 'PAID', payment_method: paymentMethod, paid_at: date, payment_entry_id: paymentEntryId })
      .eq('id', id);
  } catch (error) {
    return { success: false, error: await errorMessage(error) };
  }
  revalidatePath('/accounting', 'layout');
  return { success: true };
}

/** Annule une dépense : ses écritures sont contrepassées (jamais supprimées). */
export async function cancelExpense(id: string, reason?: string): Promise<Result> {
  const scope = await getScope();
  if (!scope?.canPost || !scope.structureId) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data: expense } = await admin
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('structure_id', scope.structureId)
    .maybeSingle();
  if (!expense) return { success: false, error: await te('accounting.errors.expenseNotFound') };
  if (expense.status === 'CANCELLED') return { success: true };
  try {
    if (expense.payment_entry_id) await reverseEntry(expense.payment_entry_id, { createdBy: scope.userId, reason });
    if (expense.entry_id) await reverseEntry(expense.entry_id, { createdBy: scope.userId, reason });
    await admin.from('expenses').update({ status: 'CANCELLED' }).eq('id', id);
  } catch (error) {
    return { success: false, error: await errorMessage(error) };
  }
  revalidatePath('/accounting', 'layout');
  return { success: true };
}
