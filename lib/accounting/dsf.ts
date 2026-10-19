// DSF (Déclaration Statistique et Fiscale, système normal) : montants et identité de l'entité
// placés dans les cellules du modèle Excel officiel de la DGI (templates/dsf/dsf-systeme-normal.xlsx).
// Calcul pur : mêmes états que la page « États financiers » (lib/accounting/syscohada.ts).

import {
  balancesAt,
  dayBefore,
  fixedAssetsNote,
  movements,
  officialBalanceSheet,
  officialCashFlow,
  officialIncomeStatement,
  type OfficialLine,
} from '@/lib/accounting/syscohada';
import type { TemplateEdits } from '@/lib/xlsx-template';

export type DsfIdentity = {
  name: string;
  niu?: string | null;
  rccm?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type DsfInput = {
  identity: DsfIdentity;
  lines: OfficialLine[];
  /** Exercice déclaré (AAAA-MM-JJ). */
  from: string;
  to: string;
  /** Exercice précédent (colonnes N-1). */
  previousFrom: string;
  previousTo: string;
};

// ── Feuilles et cellules du modèle DGI ───────────────────

const SHEETS = {
  cover: 'PAGE DE GARDE',
  r1: 'Fiche R1',
  balance: 'BILAN PAYSAGE',
  income: 'COMPTE DE RESULTAT',
  cash: 'TABLEAU DES FLUX DE TRESORERIE',
  note3a: 'NOTE 3A',
  note3c: 'NOTE  3C',
} as const;

/** Ligne de chaque poste du bilan. Le modèle note BC et DY ce que le SYSCOHADA révisé nomme BG et DV. */
const ASSET_ROWS: Record<string, number> = {
  AD: 12, AE: 13, AF: 14, AG: 15, AH: 16, AI: 17, AJ: 18, AK: 19, AL: 20, AM: 21, AN: 22, AP: 23,
  AQ: 24, AR: 25, AS: 26, AZ: 27, BA: 28, BB: 29, BG: 30, BH: 31, BI: 32, BJ: 33, BK: 34, BQ: 35,
  BR: 36, BS: 37, BT: 38, BU: 39, BZ: 40,
};
const LIABILITY_ROWS: Record<string, number> = {
  CA: 12, CB: 13, CD: 14, CE: 15, CF: 16, CG: 17, CH: 18, CJ: 19, CL: 20, CM: 21, CP: 22, DA: 23,
  DB: 24, DC: 25, DD: 26, DF: 27, DH: 28, DI: 29, DJ: 30, DK: 31, DM: 32, DN: 33, DP: 34, DQ: 36,
  DR: 37, DT: 38, DV: 39, DZ: 40,
};
const INCOME_ROWS: Record<string, number> = {
  TA: 11, RA: 12, RB: 13, XA: 14, TB: 15, TC: 16, TD: 17, XB: 18, TE: 19, TF: 20, TG: 21, TH: 22,
  TI: 23, RC: 24, RD: 25, RE: 26, RF: 27, RG: 28, RH: 29, RI: 30, RJ: 31, XC: 32, RK: 33, XD: 34,
  TJ: 35, RL: 36, XE: 37, TK: 38, TL: 39, TM: 40, RM: 41, RN: 42, XF: 43, XG: 44, TN: 45, TO: 46,
  RO: 47, RP: 48, XH: 49, RQ: 50, RS: 51, XI: 52,
};
const CASH_ROWS: Record<string, number> = {
  ZA: 10, FA: 12, FB: 13, FC: 14, FD: 15, FE: 16, ZB: 18, FF: 20, FG: 21, FH: 22, FI: 23, FJ: 24,
  ZC: 25, FK: 27, FL: 28, FM: 29, FN: 30, ZD: 31, FO: 33, FP: 34, FQ: 35, ZE: 36, ZF: 37, ZG: 38, ZH: 39,
};
/** Ligne sans référence du tableau des flux : variation du besoin de financement (FB+FC+FD+FE). */
const CASH_WORKING_CAPITAL_ROW = 17;

/** Correspondances avec le modèle, vérifiées par les tests contre le fichier de la DGI. */
export const DSF_LAYOUT = { SHEETS, ASSET_ROWS, LIABILITY_ROWS, INCOME_ROWS, CASH_ROWS } as const;

/**
 * Convention de la DSF : la colonne « + / − » du modèle porte le sens de l'opération, les montants
 * sont saisis en positif. Les charges (R…) et les lignes « − » du tableau des flux sont donc écrites
 * à l'opposé du signe comptable de Shede ; les totaux (X…, Z…) restent des sommes signées.
 */
export function dsfIncomeAmount(ref: string, amount: number) {
  return ref.startsWith('R') ? -amount : amount;
}
const CASH_SUBTRACTED = new Set(['FB', 'FC', 'FD', 'FF', 'FG', 'FH', 'FM', 'FN', 'FQ']);
export function dsfCashAmount(ref: string, amount: number) {
  return CASH_SUBTRACTED.has(ref) ? -amount : amount;
}

// ── Dates et en-têtes ─────────────────────────────────────

const frDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

/** Durée de l'exercice en mois (arrondie). */
export function monthsBetween(from: string, to: string) {
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  return Math.max(1, Math.round(days / 30.4375));
}

/**
 * Textes communs du modèle (en-tête répété sur chaque page, page de garde) réécrits avec
 * l'identité de l'entité. Renvoie null pour les autres textes, laissés tels quels.
 */
export function dsfSharedText(identity: DsfIdentity, from: string, to: string) {
  const close = `${to.slice(8, 10)}-${to.slice(5, 7)}-${to.slice(0, 4)}`;
  const niu = identity.niu?.trim() || '…………………';
  const address = [identity.address, identity.city].map((s) => s?.trim()).filter(Boolean).join(', ');
  const designation = `Désignation entité : ${identity.name}          Exercice clos le ${close}`;
  const identification = `Numéro d’identification : ${niu}          Durée (en mois) : ${monthsBetween(from, to)}`;

  return (text: string): string | null => {
    const t = text.replace(/\s+/g, ' ').trim();
    const hasDesignation = /^Désignation entité/i.test(t) && /Exercice clos/i.test(t);
    const hasIdentification = /Numéro d.identification/i.test(t) && /Durée/i.test(t);
    if (hasDesignation && hasIdentification) return `${designation}\n${identification}`;
    if (hasDesignation) return designation;
    if (/^Numéro d.identification/i.test(t) && hasIdentification) return identification;
    if (/^DENOMINATION SOCIALE\s*:/i.test(t)) return `DENOMINATION SOCIALE : ${identity.name}`;
    if (/^ADRESSE COMPLETE\s*:/i.test(t) && address) return `ADRESSE COMPLETE : ${address}`;
    if (/^N° D'IDENTIFICATION FISCALE\s*:/i.test(t) && identity.niu?.trim()) return `N° D'IDENTIFICATION FISCALE : ${identity.niu.trim()}`;
    return null;
  };
}

// ── Notes 3A et 3C : immobilisations ─────────────────────

type NoteRow = ReturnType<typeof fixedAssetsNote>[number];
const NOTE_FIELDS = ['grossOpen', 'increases', 'decreases', 'grossClose', 'depOpen', 'depAdded', 'depRemoved', 'depClose'] as const;

function sumRows(rows: (NoteRow | undefined)[]) {
  const total = Object.fromEntries(NOTE_FIELDS.map((f) => [f, 0])) as Record<(typeof NOTE_FIELDS)[number], number>;
  for (const row of rows) if (row) for (const f of NOTE_FIELDS) total[f] += row[f];
  return total;
}

/** Avances sur immobilisations (251 incorporelles, 252 corporelles) : le modèle les distingue. */
function advances(lines: OfficialLine[], from: string, to: string, prefix: '251' | '252') {
  const open = balancesAt(lines, dayBefore(from));
  const mv = movements(lines, from, to);
  let grossOpen = 0;
  let increases = 0;
  let decreases = 0;
  for (const [account, balance] of open) if (account.startsWith(prefix)) grossOpen += balance;
  for (const [account, m] of mv) {
    if (!account.startsWith(prefix)) continue;
    increases += m.debit;
    decreases += m.credit;
  }
  const r = Math.round;
  return { grossOpen: r(grossOpen), increases: r(increases), decreases: r(decreases), grossClose: r(grossOpen + increases - decreases) };
}

// ── Assemblage ────────────────────────────────────────────

export function buildDsf(input: DsfInput) {
  const { identity, lines, from, to, previousFrom, previousTo } = input;
  const edits: TemplateEdits = {};
  const set = (sheet: string, ref: string, value: string | number) => {
    (edits[sheet] ??= {})[ref] = value;
  };

  // Page de garde et fiche R1
  set(SHEETS.cover, 'C20', frDate(to));
  set(SHEETS.r1, 'E9', `DU : ${frDate(from)}          AU : ${frDate(to)}`);
  if (identity.rccm?.trim()) set(SHEETS.r1, 'E15', identity.rccm.trim());
  if (identity.phone?.trim()) set(SHEETS.r1, 'C21', identity.phone.trim());
  if (identity.email?.trim()) set(SHEETS.r1, 'E21', identity.email.trim());
  if (identity.city?.trim()) set(SHEETS.r1, 'J21', identity.city.trim());
  const address = [identity.address, identity.city].map((s) => s?.trim()).filter(Boolean).join(', ');
  if (address) set(SHEETS.r1, 'D23', address);

  // Bilan
  const sheet = officialBalanceSheet(lines, to);
  const previousSheet = officialBalanceSheet(lines, previousTo);
  for (const row of sheet.assets) {
    const line = ASSET_ROWS[row.ref];
    if (!line) continue;
    set(SHEETS.balance, `D${line}`, row.gross);
    set(SHEETS.balance, `E${line}`, row.depreciation);
    set(SHEETS.balance, `F${line}`, row.net);
    set(SHEETS.balance, `G${line}`, previousSheet.assets.find((a) => a.ref === row.ref)?.net ?? 0);
  }
  for (const row of sheet.liabilities) {
    const line = LIABILITY_ROWS[row.ref];
    if (!line) continue;
    set(SHEETS.balance, `K${line}`, row.amount);
    set(SHEETS.balance, `L${line}`, previousSheet.liabilities.find((l) => l.ref === row.ref)?.amount ?? 0);
  }

  // Compte de résultat
  const income = officialIncomeStatement(lines, from, to);
  const previousIncome = officialIncomeStatement(lines, previousFrom, previousTo);
  for (const row of income.rows) {
    const line = INCOME_ROWS[row.ref];
    if (!line) continue;
    set(SHEETS.income, `E${line}`, dsfIncomeAmount(row.ref, row.amount));
    set(SHEETS.income, `F${line}`, dsfIncomeAmount(row.ref, previousIncome.rows.find((r) => r.ref === row.ref)?.amount ?? 0));
  }

  // Tableau des flux de trésorerie
  const cash = officialCashFlow(lines, from, to);
  const previousCash = officialCashFlow(lines, previousFrom, previousTo);
  const workingCapital = (rows: typeof cash.rows) =>
    ['FB', 'FC', 'FD', 'FE'].reduce((s, ref) => s + (rows.find((r) => r.ref === ref)?.amount ?? 0), 0);
  for (const row of cash.rows) {
    const line = CASH_ROWS[row.ref];
    if (!line) continue;
    set(SHEETS.cash, `E${line}`, dsfCashAmount(row.ref, row.amount));
    set(SHEETS.cash, `F${line}`, dsfCashAmount(row.ref, previousCash.rows.find((r) => r.ref === row.ref)?.amount ?? 0));
  }
  set(SHEETS.cash, `E${CASH_WORKING_CAPITAL_ROW}`, workingCapital(cash.rows));
  set(SHEETS.cash, `F${CASH_WORKING_CAPITAL_ROW}`, workingCapital(previousCash.rows));

  // Notes 3A (brut) et 3C (amortissements)
  const note = fixedAssetsNote(lines, from, to);
  const byRef = (ref: string) => note.find((n) => n.ref === ref);
  const gross = (row: number, v: { grossOpen: number; increases: number; decreases: number; grossClose: number }) => {
    if (!v.grossOpen && !v.increases && !v.decreases && !v.grossClose) return;
    set(SHEETS.note3a, `D${row}`, v.grossOpen);
    set(SHEETS.note3a, `E${row}`, v.increases);
    set(SHEETS.note3a, `H${row}`, v.decreases);
    set(SHEETS.note3a, `J${row}`, v.grossClose);
  };
  const dep = (row: number, v: { depOpen: number; depAdded: number; depRemoved: number; depClose: number }) => {
    if (!v.depOpen && !v.depAdded && !v.depRemoved && !v.depClose) return;
    set(SHEETS.note3c, `B${row}`, v.depOpen);
    set(SHEETS.note3c, `C${row}`, v.depAdded);
    set(SHEETS.note3c, `D${row}`, v.depRemoved);
    set(SHEETS.note3c, `E${row}`, v.depClose);
  };
  const intangible = ['AE', 'AF', 'AG', 'AH'];
  const tangible = ['AJ', 'AK', 'AL', 'AM', 'AN'];
  const financial = ['AR', 'AS'];
  // 3A : terrains et bâtiments « hors immeubles de placement » (Shede ne distingue pas les placements)
  const rows3a: Record<string, number> = { AE: 15, AF: 16, AG: 17, AH: 18, AJ: 20, AK: 22, AL: 24, AM: 25, AN: 26, AR: 31, AS: 32 };
  for (const [ref, row] of Object.entries(rows3a)) {
    const v = byRef(ref);
    if (v) gross(row, v);
  }
  gross(14, sumRows(intangible.map(byRef)));
  gross(19, sumRows(tangible.map(byRef)));
  gross(27, sumRows([byRef('AP')]));
  gross(28, advances(lines, from, to, '251'));
  gross(29, advances(lines, from, to, '252'));
  gross(30, sumRows(financial.map(byRef)));
  gross(33, sumRows(note));
  const rows3c: Record<string, number> = { AE: 14, AF: 15, AG: 16, AH: 17, AJ: 19, AK: 21, AL: 23, AM: 24, AN: 25 };
  for (const [ref, row] of Object.entries(rows3c)) {
    const v = byRef(ref);
    if (v) dep(row, v);
  }
  dep(18, sumRows(intangible.map(byRef)));
  dep(26, sumRows(tangible.map(byRef)));
  dep(28, sumRows([...intangible, ...tangible].map(byRef)));

  return {
    edits,
    sharedText: dsfSharedText(identity, from, to),
    /** Contrôles affichés avec le téléchargement. */
    checks: {
      balanced: (sheet.assets.find((a) => a.ref === 'BZ')?.net ?? 0) === (sheet.liabilities.find((l) => l.ref === 'DZ')?.amount ?? 0),
      cashGap: cash.gap,
      unmappedAccounts: income.unmapped,
    },
  };
}
