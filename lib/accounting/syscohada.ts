// États financiers SYSCOHADA révisé (système normal) : Bilan, Compte de résultat,
// Tableau des flux de trésorerie et note sur les immobilisations, avec les références
// officielles (AD…BZ, CA…DZ, TA…XI, ZA…ZH) reprises dans la DSF. Calculs purs.

export type OfficialLine = { account: string; entry_date: string; debit: number; credit: number; closing?: boolean };

const r = (n: number) => Math.round(n);
const startsWithAny = (account: string, prefixes: readonly string[]) => prefixes.some((p) => account.startsWith(p));

/** Le dernier jour avant `date` (AAAA-MM-JJ). */
export function dayBefore(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Soldes (débit − crédit) par compte jusqu'à `to` inclus. */
export function balancesAt(lines: OfficialLine[], to: string) {
  const map = new Map<string, number>();
  for (const l of lines) {
    if (l.entry_date > to) continue;
    map.set(l.account, (map.get(l.account) ?? 0) + Number(l.debit) - Number(l.credit));
  }
  return map;
}

/** Mouvements (débits, crédits) par compte sur la période, hors écritures de clôture. */
function movements(lines: OfficialLine[], from: string, to: string) {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    if (l.closing || l.entry_date < from || l.entry_date > to) continue;
    const m = map.get(l.account) ?? { debit: 0, credit: 0 };
    m.debit += Number(l.debit);
    m.credit += Number(l.credit);
    map.set(l.account, m);
  }
  return map;
}

// ── Bilan ────────────────────────────────────────────────

type AssetRef = 'AE' | 'AF' | 'AG' | 'AH' | 'AJ' | 'AK' | 'AL' | 'AM' | 'AN' | 'AP' | 'AR' | 'AS' | 'BA' | 'BB' | 'BH' | 'BI' | 'BJ' | 'BQ' | 'BR' | 'BS' | 'BU';
type LiabilityRef = 'CA' | 'CB' | 'CD' | 'CE' | 'CF' | 'CG' | 'CH' | 'CJ' | 'CL' | 'CM' | 'DA' | 'DB' | 'DC' | 'DH' | 'DI' | 'DJ' | 'DK' | 'DM' | 'DN' | 'DQ' | 'DR' | 'DV';

/** Poste d'actif d'un compte d'immobilisation (classe 2, hors amortissements). */
function fixedAssetRef(account: string): AssetRef | null {
  if (account.startsWith('211')) return 'AE';
  if (startsWithAny(account, ['212', '213', '214'])) return 'AF';
  if (startsWithAny(account, ['215', '216'])) return 'AG';
  if (account.startsWith('21')) return 'AH';
  if (account.startsWith('22')) return 'AJ';
  if (startsWithAny(account, ['234', '235'])) return 'AL';
  if (account.startsWith('23')) return 'AK';
  if (account.startsWith('245')) return 'AN';
  if (account.startsWith('24')) return 'AM';
  if (account.startsWith('25')) return 'AP';
  if (account.startsWith('26')) return 'AR';
  if (account.startsWith('27')) return 'AS';
  return null;
}

/**
 * Classement d'un solde au bilan. Actif : brut (solde débiteur) ou amortissements /
 * dépréciations (comptes 28, 29, 39, 49, 59) portés en déduction. Passif : solde créditeur.
 * Les comptes de tiers et de trésorerie vont à l'actif ou au passif selon le sens du solde.
 */
export function classifyBalance(account: string, balance: number):
  | { side: 'asset'; ref: AssetRef; column: 'gross' | 'depreciation'; amount: number }
  | { side: 'liability'; ref: LiabilityRef; amount: number }
  | null {
  if (!balance) return null;
  const cls = account[0];
  // Amortissements et dépréciations : en déduction de l'actif correspondant
  if (account.startsWith('28') || account.startsWith('29')) {
    const ref = fixedAssetRef(`2${account.slice(2)}`) ?? 'AM';
    return { side: 'asset', ref, column: 'depreciation', amount: -balance };
  }
  if (account.startsWith('39')) return { side: 'asset', ref: 'BB', column: 'depreciation', amount: -balance };
  if (account.startsWith('49')) {
    if (account.startsWith('499')) return { side: 'liability', ref: 'DN', amount: -balance };
    return { side: 'asset', ref: account.startsWith('491') ? 'BI' : 'BJ', column: 'depreciation', amount: -balance };
  }
  if (account.startsWith('59')) {
    if (account.startsWith('599')) return { side: 'liability', ref: 'DN', amount: -balance };
    return { side: 'asset', ref: account.startsWith('590') ? 'BQ' : 'BS', column: 'depreciation', amount: -balance };
  }

  if (cls === '1') {
    const ref: LiabilityRef = startsWithAny(account, ['101', '102', '103', '104'])
      ? 'CA'
      : account.startsWith('109')
        ? 'CB'
        : account.startsWith('105')
          ? 'CD'
          : account.startsWith('106')
            ? 'CE'
            : startsWithAny(account, ['111', '112', '113'])
              ? 'CF'
              : account.startsWith('11')
                ? 'CG'
                : account.startsWith('12')
                  ? 'CH'
                  : account.startsWith('13')
                    ? 'CJ'
                    : account.startsWith('14')
                      ? 'CL'
                      : account.startsWith('15')
                        ? 'CM'
                        : account.startsWith('17')
                          ? 'DB'
                          : account.startsWith('19')
                            ? 'DC'
                            : 'DA';
    return { side: 'liability', ref, amount: -balance };
  }
  if (cls === '2') return { side: 'asset', ref: fixedAssetRef(account) ?? 'AH', column: 'gross', amount: balance };
  if (cls === '3') return { side: 'asset', ref: 'BB', column: 'gross', amount: balance };
  if (cls === '4') {
    if (balance > 0) {
      const ref: AssetRef = account.startsWith('409')
        ? 'BH'
        : account.startsWith('41') && !account.startsWith('419')
          ? 'BI'
          : startsWithAny(account, ['485', '488'])
            ? 'BA'
            : account.startsWith('478')
              ? 'BU'
              : 'BJ';
      return { side: 'asset', ref, column: 'gross', amount: balance };
    }
    const ref: LiabilityRef = account.startsWith('419')
      ? 'DI'
      : account.startsWith('40')
        ? 'DJ'
        : startsWithAny(account, ['42', '43', '44'])
          ? 'DK'
          : startsWithAny(account, ['481', '482', '484'])
            ? 'DH'
            : account.startsWith('479')
              ? 'DV'
              : 'DM';
    return { side: 'liability', ref, amount: -balance };
  }
  if (cls === '5') {
    if (balance > 0) {
      const ref: AssetRef = account.startsWith('50') ? 'BQ' : account.startsWith('51') ? 'BR' : 'BS';
      return { side: 'asset', ref, column: 'gross', amount: balance };
    }
    return { side: 'liability', ref: startsWithAny(account, ['564', '565']) ? 'DQ' : 'DR', amount: -balance };
  }
  return null; // classes 6, 7, 8 : au résultat
}

/** Lignes du bilan dans l'ordre officiel ; `sum` = postes additionnés (totaux et sous-totaux). */
export const ASSET_LAYOUT: { ref: string; sum?: string[]; total?: boolean }[] = [
  { ref: 'AD', sum: ['AE', 'AF', 'AG', 'AH'] },
  { ref: 'AE' }, { ref: 'AF' }, { ref: 'AG' }, { ref: 'AH' },
  { ref: 'AI', sum: ['AJ', 'AK', 'AL', 'AM', 'AN'] },
  { ref: 'AJ' }, { ref: 'AK' }, { ref: 'AL' }, { ref: 'AM' }, { ref: 'AN' },
  { ref: 'AP' },
  { ref: 'AQ', sum: ['AR', 'AS'] },
  { ref: 'AR' }, { ref: 'AS' },
  { ref: 'AZ', sum: ['AD', 'AI', 'AP', 'AQ'], total: true },
  { ref: 'BA' },
  { ref: 'BB' },
  { ref: 'BG', sum: ['BH', 'BI', 'BJ'] },
  { ref: 'BH' }, { ref: 'BI' }, { ref: 'BJ' },
  { ref: 'BK', sum: ['BA', 'BB', 'BG'], total: true },
  { ref: 'BQ' }, { ref: 'BR' }, { ref: 'BS' },
  { ref: 'BT', sum: ['BQ', 'BR', 'BS'], total: true },
  { ref: 'BU' },
  { ref: 'BZ', sum: ['AZ', 'BK', 'BT', 'BU'], total: true },
];

export const LIABILITY_LAYOUT: { ref: string; sum?: string[]; total?: boolean }[] = [
  { ref: 'CA' }, { ref: 'CB' }, { ref: 'CD' }, { ref: 'CE' }, { ref: 'CF' }, { ref: 'CG' }, { ref: 'CH' }, { ref: 'CJ' }, { ref: 'CL' }, { ref: 'CM' },
  { ref: 'CP', sum: ['CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CJ', 'CL', 'CM'], total: true },
  { ref: 'DA' }, { ref: 'DB' }, { ref: 'DC' },
  { ref: 'DD', sum: ['DA', 'DB', 'DC'], total: true },
  { ref: 'DF', sum: ['CP', 'DD'], total: true },
  { ref: 'DH' }, { ref: 'DI' }, { ref: 'DJ' }, { ref: 'DK' }, { ref: 'DM' }, { ref: 'DN' },
  { ref: 'DP', sum: ['DH', 'DI', 'DJ', 'DK', 'DM', 'DN'], total: true },
  { ref: 'DQ' }, { ref: 'DR' },
  { ref: 'DT', sum: ['DQ', 'DR'], total: true },
  { ref: 'DV' },
  { ref: 'DZ', sum: ['DF', 'DP', 'DT', 'DV'], total: true },
];

export type AssetRow = { ref: string; gross: number; depreciation: number; net: number; total?: boolean };
export type AmountRow = { ref: string; amount: number; total?: boolean };

function resolveSums<T extends Record<string, number>>(layout: { ref: string; sum?: string[] }[], base: Map<string, T>, keys: (keyof T)[]) {
  const values = new Map(base);
  for (const line of layout) {
    if (!line.sum) continue;
    const acc = Object.fromEntries(keys.map((k) => [k, 0])) as T;
    for (const ref of line.sum) {
      const v = values.get(ref);
      if (v) for (const k of keys) (acc[k] as number) += v[k] as number;
    }
    values.set(line.ref, acc);
  }
  return values;
}

/** Bilan au `to`. Le résultat non encore viré (exercice non clôturé) est porté en CJ. */
export function officialBalanceSheet(lines: OfficialLine[], to: string) {
  const assets = new Map<string, { gross: number; depreciation: number }>();
  const liabilities = new Map<string, { amount: number }>();
  let unclosedResult = 0;
  for (const [account, balance] of balancesAt(lines, to)) {
    if (/^[678]/.test(account)) {
      unclosedResult -= balance;
      continue;
    }
    const c = classifyBalance(account, balance);
    if (!c) continue;
    if (c.side === 'asset') {
      const v = assets.get(c.ref) ?? { gross: 0, depreciation: 0 };
      v[c.column] += c.amount;
      assets.set(c.ref, v);
    } else {
      const v = liabilities.get(c.ref) ?? { amount: 0 };
      v.amount += c.amount;
      liabilities.set(c.ref, v);
    }
  }
  const cj = liabilities.get('CJ') ?? { amount: 0 };
  cj.amount += unclosedResult;
  liabilities.set('CJ', cj);

  const assetValues = resolveSums(ASSET_LAYOUT, assets, ['gross', 'depreciation']);
  const liabilityValues = resolveSums(LIABILITY_LAYOUT, liabilities, ['amount']);
  const assetRows: AssetRow[] = ASSET_LAYOUT.map((l) => {
    const v = assetValues.get(l.ref) ?? { gross: 0, depreciation: 0 };
    return { ref: l.ref, gross: r(v.gross), depreciation: r(v.depreciation), net: r(v.gross - v.depreciation), total: l.total };
  });
  const liabilityRows: AmountRow[] = LIABILITY_LAYOUT.map((l) => ({ ref: l.ref, amount: r(liabilityValues.get(l.ref)?.amount ?? 0), total: l.total }));
  return { assets: assetRows, liabilities: liabilityRows };
}

// ── Compte de résultat ───────────────────────────────────

/** Postes du compte de résultat : préfixes de comptes (le plus précis d'abord) et sens. */
const INCOME_ITEMS: { ref: string; prefixes: string[]; kind: 'product' | 'charge' }[] = [
  { ref: 'RB', prefixes: ['6031'], kind: 'charge' },
  { ref: 'RD', prefixes: ['6032'], kind: 'charge' },
  { ref: 'RF', prefixes: ['6033'], kind: 'charge' },
  { ref: 'TI', prefixes: ['781'], kind: 'product' },
  { ref: 'TM', prefixes: ['787'], kind: 'product' },
  { ref: 'TL', prefixes: ['797'], kind: 'product' },
  { ref: 'TJ', prefixes: ['791', '798', '799', '79'], kind: 'product' },
  { ref: 'RN', prefixes: ['697'], kind: 'charge' },
  { ref: 'RL', prefixes: ['681', '691', '68', '69'], kind: 'charge' },
  { ref: 'TA', prefixes: ['701'], kind: 'product' },
  { ref: 'TB', prefixes: ['702', '703'], kind: 'product' },
  { ref: 'TC', prefixes: ['704', '705', '706'], kind: 'product' },
  { ref: 'TD', prefixes: ['707', '70'], kind: 'product' },
  { ref: 'TE', prefixes: ['73'], kind: 'product' },
  { ref: 'TF', prefixes: ['72'], kind: 'product' },
  { ref: 'TG', prefixes: ['71'], kind: 'product' },
  { ref: 'TH', prefixes: ['75', '74', '76', '78'], kind: 'product' },
  { ref: 'TK', prefixes: ['77'], kind: 'product' },
  { ref: 'RA', prefixes: ['601'], kind: 'charge' },
  { ref: 'RC', prefixes: ['602'], kind: 'charge' },
  { ref: 'RE', prefixes: ['604', '605', '608', '60'], kind: 'charge' },
  { ref: 'RG', prefixes: ['61'], kind: 'charge' },
  { ref: 'RH', prefixes: ['62', '63'], kind: 'charge' },
  { ref: 'RI', prefixes: ['64'], kind: 'charge' },
  { ref: 'RJ', prefixes: ['65'], kind: 'charge' },
  { ref: 'RK', prefixes: ['66'], kind: 'charge' },
  { ref: 'RM', prefixes: ['67'], kind: 'charge' },
  { ref: 'TN', prefixes: ['82'], kind: 'product' },
  { ref: 'TO', prefixes: ['84', '86', '88'], kind: 'product' },
  { ref: 'RO', prefixes: ['81'], kind: 'charge' },
  { ref: 'RP', prefixes: ['83', '85'], kind: 'charge' },
  { ref: 'RQ', prefixes: ['87'], kind: 'charge' },
  { ref: 'RS', prefixes: ['89'], kind: 'charge' },
];

/** Ordre officiel, avec les soldes intermédiaires (X…) calculés comme sommes signées. */
export const INCOME_LAYOUT: { ref: string; sum?: string[] }[] = [
  { ref: 'TA' }, { ref: 'RA' }, { ref: 'RB' },
  { ref: 'XA', sum: ['TA', 'RA', 'RB'] },
  { ref: 'TB' }, { ref: 'TC' }, { ref: 'TD' },
  { ref: 'XB', sum: ['TA', 'TB', 'TC', 'TD'] },
  { ref: 'TE' }, { ref: 'TF' }, { ref: 'TG' }, { ref: 'TH' }, { ref: 'TI' },
  { ref: 'RC' }, { ref: 'RD' }, { ref: 'RE' }, { ref: 'RF' }, { ref: 'RG' }, { ref: 'RH' }, { ref: 'RI' }, { ref: 'RJ' },
  { ref: 'XC', sum: ['XB', 'RA', 'RB', 'TE', 'TF', 'TG', 'TH', 'TI', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ'] },
  { ref: 'RK' },
  { ref: 'XD', sum: ['XC', 'RK'] },
  { ref: 'TJ' }, { ref: 'RL' },
  { ref: 'XE', sum: ['XD', 'TJ', 'RL'] },
  { ref: 'TK' }, { ref: 'TL' }, { ref: 'TM' }, { ref: 'RM' }, { ref: 'RN' },
  { ref: 'XF', sum: ['TK', 'TL', 'TM', 'RM', 'RN'] },
  { ref: 'XG', sum: ['XE', 'XF'] },
  { ref: 'TN' }, { ref: 'TO' }, { ref: 'RO' }, { ref: 'RP' },
  { ref: 'XH', sum: ['TN', 'TO', 'RO', 'RP'] },
  { ref: 'RQ' }, { ref: 'RS' },
  { ref: 'XI', sum: ['XG', 'XH', 'RQ', 'RS'] },
];

function incomeRef(account: string) {
  let best: { ref: string; kind: 'product' | 'charge'; length: number } | null = null;
  for (const item of INCOME_ITEMS) {
    for (const p of item.prefixes) {
      if (account.startsWith(p) && (!best || p.length > best.length)) best = { ref: item.ref, kind: item.kind, length: p.length };
    }
  }
  return best;
}

/**
 * Compte de résultat de la période (écritures de clôture exclues). Produits en positif,
 * charges en négatif ; les soldes X… sont des sommes signées. `unmapped` : comptes de
 * gestion sans poste (à vérifier).
 */
export function officialIncomeStatement(lines: OfficialLine[], from: string, to: string) {
  const values = new Map<string, number>();
  const unmapped = new Set<string>();
  for (const [account, m] of movements(lines, from, to)) {
    if (!/^[678]/.test(account)) continue;
    const item = incomeRef(account);
    if (!item) {
      unmapped.add(account);
      continue;
    }
    values.set(item.ref, (values.get(item.ref) ?? 0) + (m.credit - m.debit));
  }
  for (const line of INCOME_LAYOUT) {
    if (line.sum) values.set(line.ref, line.sum.reduce((s, ref) => s + (values.get(ref) ?? 0), 0));
  }
  return {
    rows: INCOME_LAYOUT.map((l) => ({ ref: l.ref, amount: r(values.get(l.ref) ?? 0), total: Boolean(l.sum) })),
    result: r(values.get('XI') ?? 0),
    unmapped: [...unmapped].sort(),
  };
}

// ── Tableau des flux de trésorerie (méthode indirecte) ───

const sumBy = (map: Map<string, { debit: number; credit: number }>, prefixes: string[], side: 'debit' | 'credit') =>
  [...map.entries()].filter(([a]) => startsWithAny(a, prefixes)).reduce((s, [, m]) => s + m[side], 0);

/** Trésorerie nette (BT − DT) à une date. */
function netCash(lines: OfficialLine[], date: string) {
  const sheet = officialBalanceSheet(lines, date);
  const bt = sheet.assets.find((a) => a.ref === 'BT')?.net ?? 0;
  const dt = sheet.liabilities.find((l) => l.ref === 'DT')?.amount ?? 0;
  return bt - dt;
}

export function officialCashFlow(lines: OfficialLine[], from: string, to: string) {
  const before = dayBefore(from);
  const open = officialBalanceSheet(lines, before);
  const close = officialBalanceSheet(lines, to);
  const net = (sheet: typeof open, ref: string) => sheet.assets.find((a) => a.ref === ref)?.net ?? 0;
  const liab = (sheet: typeof open, ref: string) => sheet.liabilities.find((l) => l.ref === ref)?.amount ?? 0;
  const income = officialIncomeStatement(lines, from, to);
  const inc = (ref: string) => income.rows.find((x) => x.ref === ref)?.amount ?? 0;
  const mv = movements(lines, from, to);

  const v = new Map<string, number>();
  v.set('ZA', netCash(lines, before));
  // CAFG = résultat net + dotations − reprises − (prix de cession − valeur comptable des cessions)
  v.set('FA', inc('XI') - inc('RL') - inc('RN') - inc('TJ') - inc('TL') - inc('TN') - inc('RO'));
  v.set('FB', -(net(close, 'BA') - net(open, 'BA')));
  v.set('FC', -(net(close, 'BB') - net(open, 'BB')));
  v.set('FD', -((net(close, 'BG') + net(close, 'BU')) - (net(open, 'BG') + net(open, 'BU'))));
  v.set('FE', liab(close, 'DP') + liab(close, 'DV') - (liab(open, 'DP') + liab(open, 'DV')));
  v.set('ZB', ['FA', 'FB', 'FC', 'FD', 'FE'].reduce((s, k) => s + (v.get(k) ?? 0), 0));
  v.set('FF', -sumBy(mv, ['21'], 'debit'));
  v.set('FG', -sumBy(mv, ['22', '23', '24', '25'], 'debit'));
  v.set('FH', -sumBy(mv, ['26', '27'], 'debit'));
  v.set('FI', inc('TN'));
  v.set('FJ', sumBy(mv, ['26', '27'], 'credit'));
  v.set('ZC', ['FF', 'FG', 'FH', 'FI', 'FJ'].reduce((s, k) => s + (v.get(k) ?? 0), 0));
  v.set('FK', sumBy(mv, ['101', '102', '103', '104', '105'], 'credit'));
  v.set('FL', sumBy(mv, ['14'], 'credit'));
  v.set('FM', -sumBy(mv, ['101', '102', '103', '104'], 'debit'));
  v.set('FN', -sumBy(mv, ['465'], 'debit'));
  v.set('ZD', ['FK', 'FL', 'FM', 'FN'].reduce((s, k) => s + (v.get(k) ?? 0), 0));
  v.set('FO', sumBy(mv, ['16'], 'credit'));
  v.set('FP', sumBy(mv, ['17', '18'], 'credit'));
  v.set('FQ', -sumBy(mv, ['16', '17', '18'], 'debit'));
  v.set('ZE', ['FO', 'FP', 'FQ'].reduce((s, k) => s + (v.get(k) ?? 0), 0));
  v.set('ZF', (v.get('ZD') ?? 0) + (v.get('ZE') ?? 0));
  v.set('ZG', (v.get('ZB') ?? 0) + (v.get('ZC') ?? 0) + (v.get('ZF') ?? 0));
  v.set('ZH', (v.get('ZA') ?? 0) + (v.get('ZG') ?? 0));
  const actual = netCash(lines, to);
  const order = ['ZA', 'FA', 'FB', 'FC', 'FD', 'FE', 'ZB', 'FF', 'FG', 'FH', 'FI', 'FJ', 'ZC', 'FK', 'FL', 'FM', 'FN', 'ZD', 'FO', 'FP', 'FQ', 'ZE', 'ZF', 'ZG', 'ZH'];
  return {
    rows: order.map((ref) => ({ ref, amount: r(v.get(ref) ?? 0), total: ref.startsWith('Z') })),
    /** Trésorerie réelle au bilan de clôture, et écart avec ZH (opérations non classées). */
    actualCash: r(actual),
    gap: r(actual - (v.get('ZH') ?? 0)),
  };
}

// ── Note annexe : immobilisations ────────────────────────

export const FIXED_ASSET_REFS = ['AE', 'AF', 'AG', 'AH', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AP', 'AR', 'AS'] as const;

/** Mouvements des immobilisations (brut) et de leurs amortissements sur l'exercice. */
export function fixedAssetsNote(lines: OfficialLine[], from: string, to: string) {
  const mv = movements(lines, from, to);
  const open = balancesAt(lines, dayBefore(from));
  const rows = FIXED_ASSET_REFS.map((ref) => ({ ref, grossOpen: 0, increases: 0, decreases: 0, grossClose: 0, depOpen: 0, depAdded: 0, depRemoved: 0, depClose: 0 }));
  const byRef = new Map(rows.map((row) => [row.ref as string, row]));
  const accounts = new Set([...open.keys(), ...mv.keys()].filter((a) => a.startsWith('2')));
  for (const account of accounts) {
    const isDep = account.startsWith('28') || account.startsWith('29');
    const ref = fixedAssetRef(isDep ? `2${account.slice(2)}` : account);
    const row = ref ? byRef.get(ref) : null;
    if (!row) continue;
    const opening = open.get(account) ?? 0;
    const m = mv.get(account) ?? { debit: 0, credit: 0 };
    if (isDep) {
      row.depOpen += -opening;
      row.depAdded += m.credit;
      row.depRemoved += m.debit;
    } else {
      row.grossOpen += opening;
      row.increases += m.debit;
      row.decreases += m.credit;
    }
  }
  for (const row of rows) {
    row.grossClose = row.grossOpen + row.increases - row.decreases;
    row.depClose = row.depOpen + row.depAdded - row.depRemoved;
    for (const k of Object.keys(row) as (keyof typeof row)[]) if (k !== 'ref') (row[k] as number) = r(row[k] as number);
  }
  return rows.filter((row) => row.grossOpen || row.increases || row.decreases || row.depOpen || row.depAdded);
}
