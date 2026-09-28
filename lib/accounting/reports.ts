import { accountClass } from '@/lib/accounting/chart';
import { VAT_COLLECTED_ACCOUNTS, VAT_DEDUCTIBLE_ACCOUNTS } from '@/lib/accounting/mapping';

// Calculs des états comptables à partir des lignes d'écriture. Fonctions
// pures : le chargement des lignes est fait par app/actions/accounting.ts.

export type LedgerLine = {
  id: string;
  entry_id: string;
  structure_id: string;
  journal: string;
  entry_date: string;
  account: string;
  label: string;
  debit: number;
  credit: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Solde débiteur (positif) ou créditeur (négatif). */
function signed(lines: LedgerLine[]) {
  return round2(lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
}

export type BalanceRow = {
  account: string;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
};

/**
 * Balance générale : solde d'ouverture (avant `from`), mouvements de la
 * période et solde de clôture, par compte.
 */
export function computeBalance(lines: LedgerLine[], from: string): BalanceRow[] {
  const map = new Map<string, { opening: number; debit: number; credit: number }>();
  for (const l of lines) {
    const row = map.get(l.account) ?? { opening: 0, debit: 0, credit: 0 };
    if (l.entry_date < from) row.opening += Number(l.debit) - Number(l.credit);
    else {
      row.debit += Number(l.debit);
      row.credit += Number(l.credit);
    }
    map.set(l.account, row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([account, r]) => {
      const closing = r.opening + r.debit - r.credit;
      return {
        account,
        openingDebit: round2(Math.max(0, r.opening)),
        openingCredit: round2(Math.max(0, -r.opening)),
        debit: round2(r.debit),
        credit: round2(r.credit),
        closingDebit: round2(Math.max(0, closing)),
        closingCredit: round2(Math.max(0, -closing)),
      };
    })
    .filter((r) => r.openingDebit || r.openingCredit || r.debit || r.credit);
}

export type LedgerRow = LedgerLine & { balance: number };

/** Grand livre d'un compte (ou d'une racine : « 57 » regroupe 571, 5711…). */
export function computeLedger(lines: LedgerLine[], account: string, from: string) {
  const own = lines
    .filter((l) => l.account.startsWith(account))
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const opening = signed(own.filter((l) => l.entry_date < from));
  let running = opening;
  const rows: LedgerRow[] = own
    .filter((l) => l.entry_date >= from)
    .map((l) => {
      running = round2(running + Number(l.debit) - Number(l.credit));
      return { ...l, balance: running };
    });
  const debit = round2(rows.reduce((s, r) => s + Number(r.debit), 0));
  const credit = round2(rows.reduce((s, r) => s + Number(r.credit), 0));
  return { opening, rows, debit, credit, closing: running };
}

export type StatementGroup = { rubric: string; accounts: { account: string; amount: number }[]; total: number };

function groupByRubric(amounts: Map<string, number>): StatementGroup[] {
  const groups = new Map<string, StatementGroup>();
  for (const [account, amount] of [...amounts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!amount) continue;
    const rubric = account.slice(0, 2);
    const group = groups.get(rubric) ?? { rubric, accounts: [], total: 0 };
    group.accounts.push({ account, amount: round2(amount) });
    group.total = round2(group.total + amount);
    groups.set(rubric, group);
  }
  return [...groups.values()];
}

/** Compte de résultat de la période : produits (classe 7) − charges (classe 6). */
export function computeIncomeStatement(lines: LedgerLine[], from: string, to: string) {
  const charges = new Map<string, number>();
  const products = new Map<string, number>();
  for (const l of lines) {
    if (l.entry_date < from || l.entry_date > to) continue;
    const cls = accountClass(l.account);
    if (cls === 6) charges.set(l.account, (charges.get(l.account) ?? 0) + Number(l.debit) - Number(l.credit));
    if (cls === 7) products.set(l.account, (products.get(l.account) ?? 0) + Number(l.credit) - Number(l.debit));
  }
  const chargeGroups = groupByRubric(charges);
  const productGroups = groupByRubric(products);
  const totalCharges = round2(chargeGroups.reduce((s, g) => s + g.total, 0));
  const totalProducts = round2(productGroups.reduce((s, g) => s + g.total, 0));
  const revenue = round2(productGroups.find((g) => g.rubric === '70')?.total ?? 0);
  return {
    charges: chargeGroups,
    products: productGroups,
    totalCharges,
    totalProducts,
    revenue,
    result: round2(totalProducts - totalCharges),
  };
}

/**
 * Bilan à la date `to` (toutes les écritures jusqu'à cette date).
 * Comptes de tiers et de trésorerie classés à l'actif ou au passif selon le
 * sens de leur solde. Le résultat non encore affecté (classes 6 et 7) est
 * présenté dans les capitaux propres.
 */
export function computeBalanceSheet(lines: LedgerLine[], to: string) {
  const balances = new Map<string, number>();
  for (const l of lines) {
    if (l.entry_date > to) continue;
    balances.set(l.account, (balances.get(l.account) ?? 0) + Number(l.debit) - Number(l.credit));
  }
  const assets = new Map<string, number>();
  const liabilities = new Map<string, number>();
  let result = 0;
  for (const [account, balance] of balances) {
    const cls = accountClass(account);
    if (!balance) continue;
    if (cls === 6 || cls === 7) {
      result -= balance;
      continue;
    }
    if (cls === 1) liabilities.set(account, -balance);
    else if (cls === 2 || cls === 3) assets.set(account, balance);
    else if (balance > 0) assets.set(account, balance);
    else liabilities.set(account, -balance);
  }
  const assetGroups = groupByRubric(assets);
  const liabilityGroups = groupByRubric(liabilities);
  const totalAssets = round2(assetGroups.reduce((s, g) => s + g.total, 0));
  const totalLiabilities = round2(liabilityGroups.reduce((s, g) => s + g.total, 0) + result);
  return {
    assets: assetGroups,
    liabilities: liabilityGroups,
    result: round2(result),
    totalAssets,
    totalLiabilities,
  };
}

/** Déclaration de TVA de la période : collectée − déductible. */
export function computeVat(lines: LedgerLine[], from: string, to: string) {
  const inPeriod = lines.filter((l) => l.entry_date >= from && l.entry_date <= to);
  const sum = (accounts: string[], sign: 1 | -1) =>
    round2(
      inPeriod
        .filter((l) => accounts.some((a) => l.account.startsWith(a)))
        .reduce((s, l) => s + sign * (Number(l.credit) - Number(l.debit)), 0)
    );
  const collected = sum(VAT_COLLECTED_ACCOUNTS, 1);
  const deductible = sum(VAT_DEDUCTIBLE_ACCOUNTS, -1);
  const salesBase = round2(
    inPeriod.filter((l) => l.account.startsWith('70')).reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0)
  );
  const net = round2(collected - deductible);
  return { collected, deductible, salesBase, net, toPay: Math.max(0, net), credit: Math.max(0, -net) };
}

/** Solde (débit − crédit) cumulé des comptes commençant par `prefix`, jusqu'à `to`. */
export function accountBalance(lines: LedgerLine[], prefix: string, to?: string) {
  return signed(lines.filter((l) => l.account.startsWith(prefix) && (!to || l.entry_date <= to)));
}
