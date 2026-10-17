import { describe, expect, it } from 'vitest';
import { cumulativeDepreciation, depreciationEnd, depreciationSchedule, netBookValue } from '@/lib/fixed-assets';
import { closingEntryLines, nextFiscalYear } from '@/lib/accounting/closing';

describe('amortissement linéaire prorata temporis', () => {
  const van = { cost: 12_000_000, in_service_date: '2026-04-01', useful_life_months: 48 }; // 3 000 000 / an

  it('annuité au prorata des jours la première année', () => {
    // 1er avril → 31 décembre : 275 jours → 3 000 000 × 275 / 365
    expect(cumulativeDepreciation(van, '2026-12-31')).toBe(2260274);
    expect(cumulativeDepreciation(van, '2026-03-31')).toBe(0); // pas encore en service
  });

  it('plan sur 5 années civiles, total égal au coût, dernière annuité ajustée', () => {
    const plan = depreciationSchedule(van);
    expect(plan.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(plan.reduce((s, r) => s + r.depreciation, 0)).toBe(12_000_000);
    expect(plan.at(-1)!.closing).toBe(0);
    expect(plan[1].depreciation).toBe(3_000_000);
    expect(depreciationEnd(van)).toBe('2030-04-01');
  });

  it('valeur nette comptable, et terrain non amortissable', () => {
    expect(netBookValue(van, '2026-12-31')).toBe(12_000_000 - 2260274);
    expect(cumulativeDepreciation(van, '2031-01-01')).toBe(12_000_000);
    const land = { cost: 30_000_000, in_service_date: '2026-01-01', useful_life_months: 0 };
    expect(cumulativeDepreciation(land, '2030-12-31')).toBe(0);
    expect(depreciationSchedule(land)).toEqual([]);
  });
});

describe('clôture d’exercice', () => {
  const lines = [
    { account: '706', entry_date: '2026-03-01', debit: 0, credit: 1_000_000 },
    { account: '701', entry_date: '2026-05-01', debit: 0, credit: 200_000 },
    { account: '601', entry_date: '2026-05-01', debit: 300_000, credit: 0 },
    { account: '681', entry_date: '2026-12-31', debit: 150_000, credit: 0 },
    { account: '521', entry_date: '2026-05-01', debit: 900_000, credit: 0 }, // bilan : non concerné
    { account: '706', entry_date: '2027-01-02', debit: 0, credit: 999 }, // exercice suivant
  ];

  it('solde les comptes de gestion et porte le bénéfice au 131', () => {
    const { lines: entry, result } = closingEntryLines(lines, '2026-01-01', '2026-12-31');
    expect(result).toBe(750_000);
    expect(entry).toEqual([
      { account: '601', credit: 300_000 },
      { account: '681', credit: 150_000 },
      { account: '701', debit: 200_000 },
      { account: '706', debit: 1_000_000 },
      { account: '131', credit: 750_000 },
    ]);
    const debit = entry.reduce((s, l) => s + (l.debit ?? 0), 0);
    const credit = entry.reduce((s, l) => s + (l.credit ?? 0), 0);
    expect(debit).toBe(credit); // écriture équilibrée
  });

  it('perte au débit du 139 ; une clôture déjà passée est ignorée', () => {
    const loss = [
      { account: '706', entry_date: '2026-03-01', debit: 0, credit: 100_000 },
      { account: '622', entry_date: '2026-03-01', debit: 250_000, credit: 0 },
      { account: '706', entry_date: '2026-12-31', debit: 100_000, credit: 0, closing: true },
    ];
    const { lines: entry, result } = closingEntryLines(loss, '2026-01-01', '2026-12-31');
    expect(result).toBe(-150_000);
    expect(entry.at(-1)).toEqual({ account: '139', debit: 150_000 });
  });

  it('exercice suivant de 12 mois', () => {
    expect(nextFiscalYear('2026-12-31')).toEqual({ start: '2027-01-01', end: '2027-12-31' });
    expect(nextFiscalYear('2026-06-30')).toEqual({ start: '2026-07-01', end: '2027-06-30' });
  });
});
