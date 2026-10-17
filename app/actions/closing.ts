'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { ACCOUNTING_MODULE, canPostEntries } from '@/lib/accounting/permissions';
import { AccountingError, accountingDate, postEntry, reverseEntry } from '@/lib/accounting/posting';
import { closingEntryLines, nextFiscalYear } from '@/lib/accounting/closing';
import { ASSET_CATEGORIES, ASSET_CATEGORY_KEYS, cumulativeDepreciation, depreciationSchedule, type AssetCategory } from '@/lib/fixed-assets';
import { fetchAll } from '@/lib/pagination';
import { getMissingSalesCount } from '@/app/actions/accounting';

// Clôture d'exercice et immobilisations (docs/phase26-closing-assets.sql).
// Réservé à l'administrateur et au comptable du point ; la réouverture, à l'administrateur.

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPPLIERS_OF_ASSETS = '481';

async function requireAccountant() {
  const session = await getSession();
  if (!session?.structureId || !session.modules?.includes(ACCOUNTING_MODULE) || !canPostEntries(session.role)) return null;
  return session as typeof session & { structureId: string };
}

async function lockedUntil(structureId: string) {
  const { data } = await getAdminSupabase().from('structures').select('accounting_locked_until').eq('id', structureId).maybeSingle();
  return (data?.accounting_locked_until as string | null) ?? null;
}

async function closingError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error ?? '');
  if (error instanceof AccountingError && error.code === 'PERIOD_LOCKED') return te('accounting.errors.periodLocked');
  if (error instanceof AccountingError && error.code === 'UNBALANCED') return te('accounting.errors.unbalanced');
  if (message.includes('relation') && message.includes('does not exist')) return te('accounting.closing.errors.notInstalled');
  console.error('[closing]', error);
  return te('errors.unexpected');
}

function revalidateClosing() {
  revalidatePath('/accounting', 'layout');
}

// ── Immobilisations ──────────────────────────────────────

export type FixedAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  asset_account: string;
  depreciation_account: string | null;
  expense_account: string;
  acquisition_date: string;
  in_service_date: string;
  cost: number;
  useful_life_months: number;
  reference: string | null;
  notes: string | null;
  status: 'ACTIVE' | 'DISPOSED';
  acquisition_entry_id: string | null;
};

export type FixedAssetRow = FixedAsset & { cumulative: number; posted: number; pending: number; netBookValue: number };

const ASSET_COLUMNS =
  'id, name, category, asset_account, depreciation_account, expense_account, acquisition_date, in_service_date, cost, useful_life_months, reference, notes, status, acquisition_entry_id';

/** Immobilisations du point avec amortissements cumulés au `asOf`, déjà passés et restant à passer. */
export async function listFixedAssets(asOf?: string | null): Promise<{ asOf: string; assets: FixedAssetRow[]; pendingTotal: number } | null> {
  const session = await requireAccountant();
  if (!session) return null;
  const date = asOf && DATE_RE.test(asOf) ? asOf : accountingDate();
  const admin = getAdminSupabase();
  const [{ data: assets, error }, postings] = await Promise.all([
    admin.from('fixed_assets').select(ASSET_COLUMNS).eq('structure_id', session.structureId).order('in_service_date').order('name'),
    fetchAll<{ asset_id: string; amount: number }>((f, t) =>
      admin.from('fixed_asset_depreciations').select('asset_id, amount').eq('structure_id', session.structureId).order('id').range(f, t)
    ).catch(() => []),
  ]);
  if (error) return { asOf: date, assets: [], pendingTotal: 0 };
  const posted = new Map<string, number>();
  for (const p of postings) posted.set(p.asset_id, (posted.get(p.asset_id) ?? 0) + Number(p.amount));
  const rows = ((assets ?? []) as FixedAsset[]).map((a) => {
    const asset = { ...a, cost: Number(a.cost) };
    const cumulative = cumulativeDepreciation(asset, date);
    const done = Math.round(posted.get(a.id) ?? 0);
    return {
      ...asset,
      cumulative,
      posted: done,
      pending: a.status === 'ACTIVE' ? Math.max(0, cumulative - done) : 0,
      netBookValue: Math.round(asset.cost) - Math.max(cumulative, done),
    };
  });
  return { asOf: date, assets: rows, pendingTotal: rows.reduce((s, r) => s + r.pending, 0) };
}

export async function getFixedAsset(id: string) {
  const session = await requireAccountant();
  if (!session || !UUID_RE.test(id)) return null;
  const admin = getAdminSupabase();
  const [{ data: asset }, { data: postings }] = await Promise.all([
    admin.from('fixed_assets').select(ASSET_COLUMNS).eq('id', id).eq('structure_id', session.structureId).maybeSingle(),
    admin.from('fixed_asset_depreciations').select('period_end, amount, entry_id').eq('asset_id', id).order('period_end'),
  ]);
  if (!asset) return null;
  const a = { ...(asset as FixedAsset), cost: Number(asset.cost) };
  return { asset: a, schedule: depreciationSchedule(a), postings: (postings ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) };
}

export async function saveFixedAsset(input: {
  id?: string;
  name: string;
  category: string;
  acquisitionDate: string;
  inServiceDate: string;
  cost: number;
  usefulLifeMonths: number;
  reference?: string;
  notes?: string;
  /** Création : passer l'écriture d'acquisition (2x / 481 fournisseurs d'investissements). */
  postAcquisition?: boolean;
}): Promise<Result<{ id: string; accountingWarning?: string }>> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const name = String(input.name ?? '').trim();
  if (!name) return { success: false, error: await te('accounting.assets.errors.nameRequired') };
  if (!ASSET_CATEGORY_KEYS.includes(input.category as AssetCategory)) return { success: false, error: await te('accounting.assets.errors.category') };
  if (!DATE_RE.test(input.acquisitionDate) || !DATE_RE.test(input.inServiceDate) || input.inServiceDate < input.acquisitionDate) {
    return { success: false, error: await te('accounting.assets.errors.dates') };
  }
  const cost = Math.round(Number(input.cost) * 100) / 100;
  if (!(cost > 0)) return { success: false, error: await te('accounting.assets.errors.cost') };
  const category = ASSET_CATEGORIES[input.category as AssetCategory];
  const months = category.months === 0 ? 0 : Math.round(Number(input.usefulLifeMonths));
  if (category.months !== 0 && !(months >= 1 && months <= 1200)) return { success: false, error: await te('accounting.assets.errors.life') };

  const admin = getAdminSupabase();
  const payload = {
    name: name.slice(0, 150),
    category: input.category,
    asset_account: category.asset,
    depreciation_account: category.depreciation,
    acquisition_date: input.acquisitionDate,
    in_service_date: input.inServiceDate,
    cost,
    useful_life_months: months,
    reference: String(input.reference ?? '').trim().slice(0, 120) || null,
    notes: String(input.notes ?? '').trim().slice(0, 1000) || null,
  };

  if (input.id) {
    // Après une première dotation, seuls le nom, la référence et les notes restent modifiables
    const { count } = await admin.from('fixed_asset_depreciations').select('id', { count: 'exact', head: true }).eq('asset_id', input.id);
    const update = count ? { name: payload.name, reference: payload.reference, notes: payload.notes } : payload;
    const { error } = await admin.from('fixed_assets').update(update).eq('id', input.id).eq('structure_id', session.structureId);
    if (error) return { success: false, error: await closingError(error) };
    revalidateClosing();
    return { success: true, data: { id: input.id } };
  }

  const { data, error } = await admin
    .from('fixed_assets')
    .insert({ ...payload, structure_id: session.structureId, created_by: session.userId })
    .select('id')
    .single();
  if (error || !data) return { success: false, error: await closingError(error) };

  let accountingWarning: string | undefined;
  if (input.postAcquisition) {
    try {
      const entryId = await postEntry({
        structureId: session.structureId,
        journal: 'OD',
        date: input.acquisitionDate,
        label: `${await te('accounting.assets.acquisitionLabel')} — ${payload.name}`,
        reference: payload.reference,
        sourceType: 'ASSET_ACQUISITION',
        sourceId: data.id as string,
        createdBy: session.userId,
        lines: [
          { account: category.asset, debit: cost },
          { account: SUPPLIERS_OF_ASSETS, credit: cost },
        ],
      });
      await admin.from('fixed_assets').update({ acquisition_entry_id: entryId }).eq('id', data.id);
    } catch (postError) {
      accountingWarning = await closingError(postError);
    }
  }
  revalidateClosing();
  return { success: true, data: { id: data.id as string, accountingWarning } };
}

/**
 * Dotations aux amortissements jusqu'au `asOf` : pour chaque bien actif, l'amortissement
 * cumulé à cette date moins ce qui a déjà été passé. Une écriture (681 / 28x) pour tous les
 * biens, et une ligne mémorisée par bien (jamais passée deux fois pour la même date).
 */
export async function postDepreciations(asOf: string): Promise<Result<{ amount: number; assets: number }>> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (!DATE_RE.test(asOf)) return { success: false, error: await te('accounting.errors.invalidDate') };
  const locked = await lockedUntil(session.structureId);
  if (locked && asOf <= locked) return { success: false, error: await te('accounting.errors.periodLocked') };
  const list = await listFixedAssets(asOf);
  const due = (list?.assets ?? []).filter((a) => a.pending > 0 && a.depreciation_account);
  if (!due.length) return { success: true, data: { amount: 0, assets: 0 } };

  const debit = new Map<string, number>();
  const credit = new Map<string, number>();
  for (const a of due) {
    debit.set(a.expense_account, (debit.get(a.expense_account) ?? 0) + a.pending);
    credit.set(a.depreciation_account!, (credit.get(a.depreciation_account!) ?? 0) + a.pending);
  }
  const amount = due.reduce((s, a) => s + a.pending, 0);
  const admin = getAdminSupabase();
  try {
    const entryId = await postEntry({
      structureId: session.structureId,
      journal: 'OD',
      date: asOf,
      label: await te('accounting.assets.depreciationLabel', { date: asOf.split('-').reverse().join('/') }),
      sourceType: 'DEPRECIATION',
      createdBy: session.userId,
      lines: [
        ...[...debit.entries()].map(([account, value]) => ({ account, debit: value })),
        ...[...credit.entries()].map(([account, value]) => ({ account, credit: value })),
      ],
    });
    const { error } = await admin.from('fixed_asset_depreciations').insert(
      due.map((a) => ({ structure_id: session.structureId, asset_id: a.id, period_end: asOf, amount: a.pending, entry_id: entryId }))
    );
    if (error) {
      // Dotation déjà mémorisée pour cette date (double clic) : on annule l'écriture en trop
      await reverseEntry(entryId, { createdBy: session.userId, date: asOf, reason: 'doublon' }).catch(() => null);
      return { success: false, error: await te('accounting.assets.errors.alreadyPosted') };
    }
  } catch (error) {
    return { success: false, error: await closingError(error) };
  }
  revalidateClosing();
  return { success: true, data: { amount, assets: due.length } };
}

// ── Exercices ────────────────────────────────────────────

export type FiscalYear = {
  id: string;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'CLOSED';
  result: number | null;
  closing_entry_id: string | null;
  closed_at: string | null;
};

/** Exercices clôturés et exercice en cours (le suivant du dernier clôturé, ou l'année civile de la première écriture). */
export async function getFiscalYears(): Promise<{ years: FiscalYear[]; current: { start: string; end: string }; lockedUntil: string | null } | null> {
  const session = await requireAccountant();
  if (!session) return null;
  const admin = getAdminSupabase();
  const [{ data: years }, { data: first }, locked] = await Promise.all([
    admin.from('fiscal_years').select('id, start_date, end_date, status, result, closing_entry_id, closed_at').eq('structure_id', session.structureId).order('start_date', { ascending: false }),
    admin.from('accounting_entries').select('entry_date').eq('structure_id', session.structureId).order('entry_date').limit(1).maybeSingle(),
    lockedUntil(session.structureId),
  ]);
  const list = ((years ?? []) as FiscalYear[]).map((y) => ({ ...y, result: y.result == null ? null : Number(y.result) }));
  const lastClosed = list.find((y) => y.status === 'CLOSED');
  const year = (first?.entry_date as string | undefined)?.slice(0, 4) ?? accountingDate().slice(0, 4);
  const current = lastClosed ? nextFiscalYear(lastClosed.end_date) : { start: `${year}-01-01`, end: `${year}-12-31` };
  return { years: list, current, lockedUntil: locked };
}

async function closingLines(structureId: string, start: string, end: string) {
  const rows = await fetchAll<{ account: string; entry_date: string; debit: number; credit: number; accounting_entries: { source_type: string } | { source_type: string }[] | null }>((f, t) =>
    getAdminSupabase()
      .from('accounting_lines')
      .select('account, entry_date, debit, credit, accounting_entries(source_type)')
      .eq('structure_id', structureId)
      .gte('entry_date', start)
      .lte('entry_date', end)
      .order('id')
      .range(f, t)
  );
  return rows.map((r) => {
    const entry = Array.isArray(r.accounting_entries) ? r.accounting_entries[0] : r.accounting_entries;
    return { account: r.account, entry_date: r.entry_date, debit: Number(r.debit), credit: Number(r.credit), closing: (entry?.source_type ?? '').startsWith('YEAR_CLOSING') };
  });
}

export type ClosingCheck = { key: string; count: number; amount?: number; blocking: boolean; href: string };

/** Aperçu de la clôture : résultat, et points à vérifier avant (brouillons, banque, dotations, ventes non comptabilisées). */
export async function getClosingPreview(start: string, end: string) {
  const session = await requireAccountant();
  if (!session || !DATE_RE.test(start) || !DATE_RE.test(end) || end < start) return null;
  const admin = getAdminSupabase();
  const [lines, drafts, unmatched, assets, missingSales, locked] = await Promise.all([
    closingLines(session.structureId, start, end),
    admin.from('sales_documents').select('id', { count: 'exact', head: true }).eq('structure_id', session.structureId).eq('status', 'DRAFT').neq('kind', 'QUOTE').lte('issue_date', end),
    admin.from('bank_statement_lines').select('id', { count: 'exact', head: true }).eq('structure_id', session.structureId).eq('status', 'UNMATCHED').lte('value_date', end),
    listFixedAssets(end),
    getMissingSalesCount({ from: start, to: end }),
    lockedUntil(session.structureId),
  ]);
  const { lines: entry, result } = closingEntryLines(lines, start, end);
  const checks: ClosingCheck[] = [
    { key: 'drafts', count: drafts.count ?? 0, blocking: false, href: '/accounting/invoices?state=DRAFT' },
    { key: 'bank', count: unmatched.count ?? 0, blocking: false, href: '/accounting/bank' },
    { key: 'depreciation', count: assets?.assets.filter((a) => a.pending > 0).length ?? 0, amount: assets?.pendingTotal ?? 0, blocking: false, href: '/accounting/assets' },
    { key: 'sales', count: missingSales, blocking: false, href: '/accounting' },
    { key: 'locked', count: locked && locked >= end ? 1 : 0, blocking: true, href: '/accounting' },
  ];
  const sum = (prefix: string, sign: 1 | -1) =>
    Math.round(lines.filter((l) => !l.closing && l.account.startsWith(prefix)).reduce((s, l) => s + sign * (l.debit - l.credit), 0));
  return { start, end, result, products: sum('7', -1), charges: sum('6', 1), entryLines: entry.length, checks, lockedUntil: locked };
}

/**
 * Clôture : écriture de solde des comptes de gestion vers le résultat (131 / 139), datée du
 * dernier jour, puis verrouillage de toute la période jusqu'à cette date.
 */
export async function closeFiscalYear(start: string, end: string): Promise<Result<{ result: number }>> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const years = await getFiscalYears();
  if (!years) return { success: false, error: await te('errors.unauthorized') };
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || end < start) return { success: false, error: await te('accounting.errors.invalidPeriod') };
  // L'exercice suit le dernier clôturé, sans trou ni chevauchement
  const lastClosed = years.years.find((y) => y.status === 'CLOSED');
  if (lastClosed && start !== nextFiscalYear(lastClosed.end_date).start) return { success: false, error: await te('accounting.closing.errors.sequence') };
  if (years.lockedUntil && years.lockedUntil >= end) return { success: false, error: await te('accounting.errors.periodLocked') };

  const admin = getAdminSupabase();
  const { data: year, error: yearError } = await admin
    .from('fiscal_years')
    .upsert({ structure_id: session.structureId, start_date: start, end_date: end, status: 'OPEN' }, { onConflict: 'structure_id,start_date' })
    .select('id')
    .single();
  if (yearError || !year) return { success: false, error: await closingError(yearError) };

  const { lines, result } = closingEntryLines(await closingLines(session.structureId, start, end), start, end);
  let entryId: string | null = null;
  try {
    if (lines.length >= 2) {
      entryId = await postEntry({
        structureId: session.structureId,
        journal: 'OD',
        date: end,
        label: await te('accounting.closing.entryLabel', { from: start.split('-').reverse().join('/'), to: end.split('-').reverse().join('/') }),
        sourceType: 'YEAR_CLOSING',
        sourceId: year.id as string,
        createdBy: session.userId,
        lines,
      });
    }
  } catch (error) {
    return { success: false, error: await closingError(error) };
  }

  await admin.from('structures').update({ accounting_locked_until: end }).eq('id', session.structureId);
  await admin
    .from('fiscal_years')
    .update({ status: 'CLOSED', result, closing_entry_id: entryId, closed_at: new Date().toISOString(), closed_by: session.userId, end_date: end })
    .eq('id', year.id);
  revalidateClosing();
  return { success: true, data: { result } };
}

/** Réouverture du dernier exercice clôturé (administrateur) : annule l'écriture de clôture et lève le verrou. */
export async function reopenFiscalYear(id: string): Promise<Result> {
  const session = await requireAccountant();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  if (session.role !== 'ADMIN') return { success: false, error: await te('accounting.errors.unlockAdminOnly') };
  const years = await getFiscalYears();
  const latest = years?.years.find((y) => y.status === 'CLOSED');
  if (!latest || latest.id !== id) return { success: false, error: await te('accounting.closing.errors.onlyLatest') };
  const previous = years!.years.find((y) => y.status === 'CLOSED' && y.end_date < latest.start_date);
  const admin = getAdminSupabase();

  await admin.from('structures').update({ accounting_locked_until: previous?.end_date ?? null }).eq('id', session.structureId);
  try {
    if (latest.closing_entry_id) {
      await reverseEntry(latest.closing_entry_id, { createdBy: session.userId, date: latest.end_date, sourceType: 'YEAR_CLOSING_REVERSAL' });
    }
  } catch (error) {
    await admin.from('structures').update({ accounting_locked_until: latest.end_date }).eq('id', session.structureId);
    return { success: false, error: await closingError(error) };
  }
  // L'exercice redevient « en cours » : sa fiche est retirée (une nouvelle clôture en crée une autre,
  // avec sa propre écriture). L'écriture de clôture et son annulation restent au journal.
  await admin.from('fiscal_years').delete().eq('id', id);
  revalidateClosing();
  return { success: true };
}
