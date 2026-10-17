'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { ACCOUNTING_MODULE, canPostEntries, canRecordExpenses } from '@/lib/accounting/permissions';
import { STANDARD_ACCOUNTS } from '@/lib/accounting/chart';
import { accountingDate, postEntry, AccountingError } from '@/lib/accounting/posting';
import { dedupeKeys, type StatementRow } from '@/lib/bank-import';
import { autoMatchPairs, findCombination, MATCH_WINDOW_DAYS, rankCandidates, reconciliationReport, type BookLine } from '@/lib/bank-reconciliation';
import { buildMeta, emptyPage, fetchAll, pageRange, settlePage, type Paginated } from '@/lib/pagination';

// Banque (docs/phase25-bank.sql) : comptes, import des relevés, rapprochement.
// Réservé à l'administrateur et au comptable du point (module Comptabilité).

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMPORT_ROWS = 5000;

async function requireAccountant() {
  const session = await getSession();
  if (!session?.structureId || !session.modules?.includes(ACCOUNTING_MODULE) || !canPostEntries(session.role)) return null;
  return session as typeof session & { structureId: string };
}

async function bankError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error ?? '');
  if (message.includes('BANK_LINE_ALREADY_MATCHED')) return te('accounting.bank.errors.alreadyMatched');
  if (message.includes('BANK_MATCH_AMOUNT') || message.includes('BANK_MATCH_INVALID')) return te('accounting.bank.errors.matchInvalid');
  if (message.includes('uq_bank_accounts_account')) return te('accounting.bank.errors.accountTaken');
  if (error instanceof AccountingError && error.code === 'PERIOD_LOCKED') return te('accounting.errors.periodLocked');
  if (message.includes('relation') && message.includes('does not exist')) return te('accounting.bank.errors.notInstalled');
  console.error('[bank]', error);
  return te('errors.unexpected');
}

function revalidateBank(id?: string) {
  revalidatePath('/accounting/bank');
  if (id) revalidatePath(`/accounting/bank/${id}`);
  revalidatePath('/accounting');
}

// ── Comptes bancaires ────────────────────────────────────

export type BankAccount = {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  account: string;
  opening_balance: number;
  opening_date: string;
  is_active: boolean;
};

export type BankAccountSummary = BankAccount & { bookBalance: number; bankBalance: number; unmatched: number; lastImport: string | null };

const BANK_COLUMNS = 'id, name, bank_name, account_number, account, opening_balance, opening_date, is_active';

async function bookLinesOf(structureId: string, account: string) {
  return fetchAll<{ id: string; entry_date: string; debit: number; credit: number; label: string; bank_statement_line_id: string | null }>((from, to) =>
    getAdminSupabase()
      .from('accounting_lines')
      .select('id, entry_date, debit, credit, label, bank_statement_line_id')
      .eq('structure_id', structureId)
      .eq('account', account)
      .order('entry_date')
      .order('id')
      .range(from, to)
  );
}

/** Comptes du point avec solde comptable, solde du relevé et lignes à rapprocher. */
export async function listBankAccounts(): Promise<BankAccountSummary[]> {
  const session = await requireAccountant();
  if (!session) return [];
  const admin = getAdminSupabase();
  const { data: accounts } = await admin.from('bank_accounts').select(BANK_COLUMNS).eq('structure_id', session.structureId).order('name');
  const today = accountingDate();
  return Promise.all(
    ((accounts || []) as BankAccount[]).map(async (a) => {
      const [books, statement, { count }, { data: last }] = await Promise.all([
        bookLinesOf(session.structureId, a.account),
        fetchAll<{ value_date: string; amount: number; status: string }>((from, to) =>
          admin.from('bank_statement_lines').select('value_date, amount, status').eq('bank_account_id', a.id).order('id').range(from, to)
        ),
        admin.from('bank_statement_lines').select('id', { count: 'exact', head: true }).eq('bank_account_id', a.id).eq('status', 'UNMATCHED'),
        admin.from('bank_statement_imports').select('created_at').eq('bank_account_id', a.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const report = reconciliationReport({
        asOf: today,
        openingBalance: Number(a.opening_balance),
        statementLines: statement,
        bookLines: books.map((b) => ({ ...b, reconciled: Boolean(b.bank_statement_line_id) })),
      });
      return { ...a, bookBalance: report.bookBalance, bankBalance: report.bankBalance, unmatched: count ?? 0, lastImport: (last?.created_at as string) ?? null };
    })
  );
}

export async function getBankAccount(id: string): Promise<BankAccount | null> {
  const session = await requireAccountant();
  if (!session || !UUID_RE.test(id)) return null;
  const { data } = await getAdminSupabase().from('bank_accounts').select(BANK_COLUMNS).eq('id', id).eq('structure_id', session.structureId).maybeSingle();
  return (data as BankAccount) ?? null;
}

export async function saveBankAccount(input: {
  id?: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  account: string;
  openingBalance?: number;
  openingDate?: string;
}): Promise<Result<{ id: string }>> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const name = String(input.name ?? '').trim();
  if (!name) return { success: false, error: await te('accounting.bank.errors.nameRequired') };
  const account = String(input.account ?? '').trim();
  if (!/^5[0-9]{1,11}$/.test(account)) return { success: false, error: await te('accounting.bank.errors.accountInvalid') };
  const openingDate = input.openingDate && DATE_RE.test(input.openingDate) ? input.openingDate : accountingDate();
  const admin = getAdminSupabase();

  // Sous-compte créé à la volée dans le plan (ex. 5211 « Banque Atlantique »)
  if (!STANDARD_ACCOUNTS.some((a) => a.number === account)) {
    const { data: existing } = await admin.from('accounting_accounts').select('id').eq('structure_id', session.structureId).eq('number', account).maybeSingle();
    if (!existing) await admin.from('accounting_accounts').insert({ structure_id: session.structureId, number: account, label: name.slice(0, 120) });
  }

  const payload = {
    name: name.slice(0, 120),
    bank_name: String(input.bankName ?? '').trim().slice(0, 120) || null,
    account_number: String(input.accountNumber ?? '').trim().slice(0, 60) || null,
    account,
    opening_balance: Math.round((Number(input.openingBalance) || 0) * 100) / 100,
    opening_date: openingDate,
  };
  const query = input.id
    ? admin.from('bank_accounts').update(payload).eq('id', input.id).eq('structure_id', session.structureId).select('id').single()
    : admin.from('bank_accounts').insert({ ...payload, structure_id: session.structureId }).select('id').single();
  const { data, error } = await query;
  if (error || !data) return { success: false, error: await bankError(error) };
  revalidateBank(data.id as string);
  return { success: true, data: { id: data.id as string } };
}

// ── Import du relevé ─────────────────────────────────────

export async function importStatement(input: {
  bankAccountId: string;
  fileName: string;
  rows: StatementRow[];
}): Promise<Result<{ imported: number; duplicates: number }>> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const account = await getBankAccount(input.bankAccountId);
  if (!account) return { success: false, error: await te('errors.unexpected') };

  const rows = (Array.isArray(input.rows) ? input.rows : [])
    .slice(0, MAX_IMPORT_ROWS)
    .map((r) => ({
      date: String(r.date),
      label: String(r.label ?? '').trim().slice(0, 300) || '—',
      reference: r.reference ? String(r.reference).trim().slice(0, 120) : null,
      amount: Math.round(Number(r.amount) * 100) / 100,
    }))
    .filter((r) => DATE_RE.test(r.date) && Number.isFinite(r.amount) && r.amount !== 0);
  if (!rows.length) return { success: false, error: await te('accounting.bank.errors.emptyImport') };

  const admin = getAdminSupabase();
  const dates = rows.map((r) => r.date).sort();
  const { data: imported, error: importError } = await admin
    .from('bank_statement_imports')
    .insert({
      structure_id: session.structureId,
      bank_account_id: account.id,
      file_name: String(input.fileName ?? '').slice(0, 200) || null,
      date_from: dates[0],
      date_to: dates[dates.length - 1],
      created_by: session.userId,
    })
    .select('id')
    .single();
  if (importError || !imported) return { success: false, error: await bankError(importError) };

  const keys = dedupeKeys(rows);
  const { data: inserted, error } = await admin
    .from('bank_statement_lines')
    .upsert(
      rows.map((r, i) => ({
        structure_id: session.structureId,
        bank_account_id: account.id,
        import_id: imported.id,
        value_date: r.date,
        label: r.label,
        reference: r.reference,
        amount: r.amount,
        dedupe_key: keys[i],
      })),
      { onConflict: 'bank_account_id,dedupe_key', ignoreDuplicates: true }
    )
    .select('id');
  if (error) return { success: false, error: await bankError(error) };
  const count = inserted?.length ?? 0;
  await admin.from('bank_statement_imports').update({ line_count: count, skipped_count: rows.length - count }).eq('id', imported.id);
  revalidateBank(account.id);
  return { success: true, data: { imported: count, duplicates: rows.length - count } };
}

// ── Lignes du relevé ─────────────────────────────────────

export type StatementLine = {
  id: string;
  value_date: string;
  label: string;
  reference: string | null;
  amount: number;
  status: 'UNMATCHED' | 'MATCHED' | 'IGNORED';
  accounting_line_id: string | null;
  /** Écritures rapprochées (la première, et le nombre total quand il y en a plusieurs). */
  match: { entryNumber: string; entryLabel: string; entryDate: string; count: number } | null;
};

export type StatementStats = { unmatched: number; unmatchedIn: number; unmatchedOut: number; matched: number; ignored: number };
const EMPTY_STATS: StatementStats = { unmatched: 0, unmatchedIn: 0, unmatchedOut: 0, matched: 0, ignored: 0 };

/** Lignes d'un compte, 20 par page, les plus récentes d'abord ; filtre par état. */
export async function listStatementLines(
  bankAccountId: string,
  filters: { page?: number; status?: string | null } = {}
): Promise<Paginated<StatementLine, StatementStats>> {
  const page = Math.max(1, filters.page ?? 1);
  const session = await requireAccountant();
  if (!session || !UUID_RE.test(bankAccountId)) return emptyPage(EMPTY_STATS, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  let query = admin
    .from('bank_statement_lines')
    .select('id, value_date, label, reference, amount, status, accounting_line_id', { count: 'exact' })
    .eq('bank_account_id', bankAccountId)
    .eq('structure_id', session.structureId)
    .order('value_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  const status = ['UNMATCHED', 'MATCHED', 'IGNORED'].includes(filters.status ?? '') ? filters.status! : null;
  if (status) query = query.eq('status', status);

  const [{ data, count }, all] = await Promise.all([
    settlePage(query),
    fetchAll<{ amount: number; status: string }>((f, t) =>
      admin.from('bank_statement_lines').select('amount, status').eq('bank_account_id', bankAccountId).eq('structure_id', session.structureId).order('id').range(f, t)
    ),
  ]);
  const stats = { ...EMPTY_STATS };
  for (const l of all) {
    if (l.status === 'UNMATCHED') {
      stats.unmatched++;
      if (l.amount > 0) stats.unmatchedIn += Number(l.amount);
      else stats.unmatchedOut -= Number(l.amount);
    } else if (l.status === 'MATCHED') stats.matched++;
    else stats.ignored++;
  }

  // Écritures rapprochées : numéro et libellé de la première, nombre total
  const rows = (data ?? []) as Omit<StatementLine, 'match'>[];
  const matchedIds = rows.filter((r) => r.status === 'MATCHED').map((r) => r.id);
  const matches = new Map<string, StatementLine['match']>();
  if (matchedIds.length) {
    const { data: lines } = await admin
      .from('accounting_lines')
      .select('id, entry_date, bank_statement_line_id, accounting_entries(number, label)')
      .in('bank_statement_line_id', matchedIds)
      .order('entry_date');
    for (const l of (lines || []) as any[]) {
      const entry = Array.isArray(l.accounting_entries) ? l.accounting_entries[0] : l.accounting_entries;
      const current = matches.get(l.bank_statement_line_id);
      if (current) current.count++;
      else matches.set(l.bank_statement_line_id, { entryNumber: entry?.number ?? '', entryLabel: entry?.label ?? '', entryDate: l.entry_date, count: 1 });
    }
  }
  return {
    items: rows.map((r) => ({ ...r, match: matches.get(r.id) ?? null })),
    meta: buildMeta(page, count ?? 0, stats),
  };
}

export type MatchCandidate = BookLine & { gap: number };

/**
 * Propositions pour une ligne du relevé : écritures du même montant (les plus probables
 * d'abord), une combinaison de plusieurs écritures dont la somme fait le montant, et toutes
 * les écritures non rapprochées du même sens à ±15 jours pour un regroupement manuel.
 */
export async function getMatchSuggestions(
  statementLineId: string
): Promise<{ singles: MatchCandidate[]; combination: MatchCandidate[] | null; pool: MatchCandidate[] }> {
  const empty = { singles: [], combination: null, pool: [] };
  const session = await requireAccountant();
  if (!session || !UUID_RE.test(statementLineId)) return empty;
  const admin = getAdminSupabase();
  const { data: line } = await admin
    .from('bank_statement_lines')
    .select('id, value_date, amount, label, reference, bank_accounts(account)')
    .eq('id', statementLineId)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!line) return empty;
  const bank = (Array.isArray(line.bank_accounts) ? line.bank_accounts[0] : line.bank_accounts) as { account: string };
  const amount = Number(line.amount);
  const shift = (d: string, n: number) => {
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  let query = admin
    .from('accounting_lines')
    .select('id, entry_date, debit, credit, label, accounting_entries(number, reference)')
    .eq('structure_id', session.structureId)
    .eq('account', bank.account)
    .is('bank_statement_line_id', null)
    .gte('entry_date', shift(line.value_date, -MATCH_WINDOW_DAYS))
    .lte('entry_date', shift(line.value_date, MATCH_WINDOW_DAYS))
    .order('entry_date')
    .limit(300);
  query = amount > 0 ? query.gt('debit', 0).lte('debit', amount) : query.gt('credit', 0).lte('credit', -amount);
  const { data } = await query;
  const books: BookLine[] = ((data || []) as any[]).map((l) => {
    const entry = Array.isArray(l.accounting_entries) ? l.accounting_entries[0] : l.accounting_entries;
    return { id: l.id, entry_date: l.entry_date, debit: Number(l.debit), credit: Number(l.credit), label: l.label, number: entry?.number ?? null, reference: entry?.reference ?? null };
  });
  const bankLine = { ...line, amount };
  const singles = rankCandidates(bankLine, books).slice(0, 10);
  const day = (d: string) => Math.abs(Date.parse(`${d}T00:00:00Z`) - Date.parse(`${line.value_date}T00:00:00Z`)) / 86_400_000;
  const withGap = (b: BookLine): MatchCandidate => ({ ...b, gap: day(b.entry_date) });
  // Combinaison proposée seulement quand aucune écriture seule ne fait le montant
  const combination = singles.length ? null : (findCombination(bankLine, books)?.map(withGap) ?? null);
  return { singles, combination, pool: books.map(withGap).sort((a, b) => a.gap - b.gap).slice(0, 60) };
}

/** Rapproche une ligne du relevé d'une ou plusieurs écritures (somme égale à son montant). */
export async function matchStatementLine(statementLineId: string, accountingLineIds: string | string[]): Promise<Result> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data: line } = await admin.from('bank_statement_lines').select('bank_account_id').eq('id', statementLineId).eq('structure_id', session.structureId).maybeSingle();
  if (!line) return { success: false, error: await te('errors.unexpected') };
  const ids = [...new Set((Array.isArray(accountingLineIds) ? accountingLineIds : [accountingLineIds]).filter((id) => UUID_RE.test(id)))];
  if (!ids.length) return { success: false, error: await te('accounting.bank.errors.matchInvalid') };
  const { error } = await admin.rpc('match_bank_lines', { p_statement_line_id: statementLineId, p_accounting_line_ids: ids, p_user: session.userId });
  if (error) return { success: false, error: await bankError(error) };
  revalidateBank(line.bank_account_id as string);
  return { success: true };
}

export async function unmatchStatementLine(statementLineId: string): Promise<Result> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const admin = getAdminSupabase();
  const { data: line } = await admin.from('bank_statement_lines').select('bank_account_id').eq('id', statementLineId).eq('structure_id', session.structureId).maybeSingle();
  if (!line) return { success: false, error: await te('errors.unexpected') };
  const { error } = await admin.rpc('unmatch_bank_line', { p_statement_line_id: statementLineId });
  if (error) return { success: false, error: await bankError(error) };
  revalidateBank(line.bank_account_id as string);
  return { success: true };
}

/** Ligne sans contrepartie comptable à passer (virement interne, doublon de la banque…) : ignorée, ou de nouveau à traiter. */
export async function setStatementLineIgnored(statementLineId: string, ignored: boolean): Promise<Result> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { data, error } = await getAdminSupabase()
    .from('bank_statement_lines')
    .update({ status: ignored ? 'IGNORED' : 'UNMATCHED' })
    .eq('id', statementLineId)
    .eq('structure_id', session.structureId)
    .eq('status', ignored ? 'UNMATCHED' : 'IGNORED')
    .select('bank_account_id');
  if (error || !data?.length) return { success: false, error: await bankError(error ?? 'BANK_LINE_ALREADY_MATCHED') };
  revalidateBank(data[0].bank_account_id as string);
  return { success: true };
}

/** Rapprochement automatique des lignes sans ambiguïté (un seul candidat à ±5 jours). */
export async function autoMatchStatement(bankAccountId: string): Promise<Result<{ matched: number }>> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const account = await getBankAccount(bankAccountId);
  if (!account) return { success: false, error: await te('errors.unexpected') };
  const admin = getAdminSupabase();
  const [lines, books] = await Promise.all([
    fetchAll<{ id: string; value_date: string; amount: number; label: string; reference: string | null }>((f, t) =>
      admin
        .from('bank_statement_lines')
        .select('id, value_date, amount, label, reference')
        .eq('bank_account_id', account.id)
        .eq('status', 'UNMATCHED')
        .order('id')
        .range(f, t)
    ),
    bookLinesOf(session.structureId, account.account),
  ]);
  const pairs = autoMatchPairs(
    lines.map((l) => ({ ...l, amount: Number(l.amount) })),
    books.filter((b) => !b.bank_statement_line_id).map((b) => ({ ...b, debit: Number(b.debit), credit: Number(b.credit) }))
  );
  let matched = 0;
  for (const p of pairs) {
    const { error } = await admin.rpc('match_bank_lines', { p_statement_line_id: p.lineId, p_accounting_line_ids: [p.bookId], p_user: session.userId });
    if (!error) matched++;
  }
  revalidateBank(account.id);
  return { success: true, data: { matched } };
}

/**
 * Ligne du relevé absente de la comptabilité (frais, agios, virement reçu non saisi…) :
 * écriture de trésorerie passée à la date de valeur, puis rapprochée aussitôt.
 */
export async function createEntryFromStatementLine(input: {
  statementLineId: string;
  account: string;
  label: string;
  customerId?: string | null;
  supplierId?: string | null;
}): Promise<Result> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const counterpart = String(input.account ?? '').trim();
  if (!/^[1-8][0-9]{1,11}$/.test(counterpart)) return { success: false, error: await te('accounting.bank.errors.counterpartInvalid') };
  const admin = getAdminSupabase();
  const { data: line } = await admin
    .from('bank_statement_lines')
    .select('id, value_date, label, reference, amount, status, bank_account_id, bank_accounts(account)')
    .eq('id', input.statementLineId)
    .eq('structure_id', session.structureId)
    .maybeSingle();
  if (!line || line.status !== 'UNMATCHED') return { success: false, error: await te('accounting.bank.errors.alreadyMatched') };
  const bank = (Array.isArray(line.bank_accounts) ? line.bank_accounts[0] : line.bank_accounts) as { account: string };
  if (counterpart === bank.account) return { success: false, error: await te('accounting.bank.errors.counterpartInvalid') };

  const amount = Math.abs(Number(line.amount));
  const moneyIn = Number(line.amount) > 0;
  const label = String(input.label ?? '').trim().slice(0, 250) || line.label;
  try {
    const entryId = await postEntry({
      structureId: session.structureId,
      journal: 'TR',
      date: line.value_date,
      label,
      reference: line.reference,
      sourceType: 'BANK_LINE',
      sourceId: line.id,
      createdBy: session.userId,
      lines: [
        { account: bank.account, ...(moneyIn ? { debit: amount } : { credit: amount }) },
        {
          account: counterpart,
          ...(moneyIn ? { credit: amount } : { debit: amount }),
          customer_id: counterpart.startsWith('411') ? input.customerId ?? null : null,
          supplier_id: counterpart.startsWith('401') ? input.supplierId ?? null : null,
        },
      ],
    });
    const { data: bankLine } = await admin.from('accounting_lines').select('id').eq('entry_id', entryId).eq('account', bank.account).limit(1).maybeSingle();
    if (bankLine) {
      const { error } = await admin.rpc('match_bank_lines', { p_statement_line_id: line.id, p_accounting_line_ids: [bankLine.id], p_user: session.userId });
      if (error) return { success: false, error: await bankError(error) };
    }
  } catch (error) {
    return { success: false, error: await bankError(error) };
  }
  revalidateBank(line.bank_account_id as string);
  return { success: true };
}

// ── État de rapprochement ────────────────────────────────

export async function getReconciliation(bankAccountId: string, asOf?: string | null) {
  const session = await requireAccountant();
  if (!session) return null;
  const account = await getBankAccount(bankAccountId);
  if (!account) return null;
  const date = asOf && DATE_RE.test(asOf) ? asOf : accountingDate();
  const admin = getAdminSupabase();
  const [statement, books] = await Promise.all([
    fetchAll<{ id: string; value_date: string; amount: number; status: string; label: string }>((f, t) =>
      admin.from('bank_statement_lines').select('id, value_date, amount, status, label').eq('bank_account_id', account.id).order('value_date').order('id').range(f, t)
    ),
    bookLinesOf(session.structureId, account.account),
  ]);
  const report = reconciliationReport({
    asOf: date,
    openingBalance: Number(account.opening_balance),
    statementLines: statement.map((s) => ({ ...s, amount: Number(s.amount) })),
    bookLines: books.map((b) => ({ ...b, debit: Number(b.debit), credit: Number(b.credit), reconciled: Boolean(b.bank_statement_line_id) })),
  });
  return {
    account,
    report,
    openBooks: books.filter((b) => !b.bank_statement_line_id && b.entry_date <= date).slice(-200),
    openStatement: statement.filter((s) => s.status === 'UNMATCHED' && s.value_date <= date).slice(-200),
  };
}

/** Comptes bancaires actifs proposés au paiement (factures, dépenses). Vide avant phase25. */
export async function listTreasuryChoices(): Promise<{ id: string; name: string; account: string }[]> {
  const session = await getSession();
  if (!session?.structureId || !session.modules?.includes(ACCOUNTING_MODULE) || !canRecordExpenses(session.role)) return [];
  const { data, error } = await getAdminSupabase()
    .from('bank_accounts')
    .select('id, name, account')
    .eq('structure_id', session.structureId)
    .eq('is_active', true)
    .order('name');
  if (error) return [];
  return (data ?? []) as { id: string; name: string; account: string }[];
}
