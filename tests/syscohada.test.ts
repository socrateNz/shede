import { describe, expect, it } from 'vitest';
import { classifyBalance, fixedAssetsNote, officialBalanceSheet, officialCashFlow, officialIncomeStatement } from '@/lib/accounting/syscohada';

// Exercice 2026 d'une petite entreprise de services : chaque écriture est équilibrée.
const e = (date: string, ...pairs: [string, number, number][]) => pairs.map(([account, debit, credit]) => ({ account, entry_date: date, debit, credit }));
const lines = [
  ...e('2026-01-02', ['521', 5_000_000, 0], ['101', 0, 5_000_000]), // apport en capital
  ...e('2026-03-01', ['521', 4_000_000, 0], ['162', 0, 4_000_000]), // emprunt bancaire
  ...e('2026-04-01', ['245', 12_000_000, 0], ['481', 0, 12_000_000]), // véhicule acheté à crédit
  ...e('2026-04-10', ['481', 6_000_000, 0], ['521', 0, 6_000_000]), // moitié payée
  ...e('2026-05-01', ['411', 1_192_500, 0], ['706', 0, 1_000_000], ['4432', 0, 192_500]), // facture
  ...e('2026-05-20', ['521', 700_000, 0], ['411', 0, 700_000]), // encaissement partiel
  ...e('2026-06-01', ['601', 300_000, 0], ['401', 0, 300_000]), // marchandises non payées
  ...e('2026-06-30', ['661', 200_000, 0], ['521', 0, 200_000]), // salaires
  ...e('2026-07-01', ['631', 2_500, 0], ['521', 0, 2_500]), // frais bancaires
  ...e('2026-12-31', ['681', 2_260_274, 0], ['2845', 0, 2_260_274]), // dotation
];
const get = <T extends { ref: string }>(rows: T[], ref: string) => rows.find((x) => x.ref === ref)!;

describe('SYSCOHADA — classement des comptes', () => {
  it('amortissements en déduction du poste d’origine, tiers selon le sens du solde', () => {
    expect(classifyBalance('2845', -100)).toEqual({ side: 'asset', ref: 'AN', column: 'depreciation', amount: 100 });
    expect(classifyBalance('2813', -50)).toMatchObject({ ref: 'AF', column: 'depreciation' });
    expect(classifyBalance('411', 500)).toMatchObject({ side: 'asset', ref: 'BI' });
    expect(classifyBalance('419', -500)).toMatchObject({ side: 'liability', ref: 'DI' });
    expect(classifyBalance('401', -300)).toMatchObject({ side: 'liability', ref: 'DJ' });
    expect(classifyBalance('409', 300)).toMatchObject({ side: 'asset', ref: 'BH' });
    expect(classifyBalance('4432', -10)).toMatchObject({ side: 'liability', ref: 'DK' });
    expect(classifyBalance('481', -10)).toMatchObject({ side: 'liability', ref: 'DH' });
    expect(classifyBalance('521', 10)).toMatchObject({ side: 'asset', ref: 'BS' });
    expect(classifyBalance('521', -10)).toMatchObject({ side: 'liability', ref: 'DR' }); // découvert
    expect(classifyBalance('706', -10)).toBeNull(); // au résultat
  });
});

describe('SYSCOHADA — états de l’exercice', () => {
  it('compte de résultat : soldes intermédiaires et résultat net', () => {
    const { rows, result, unmapped } = officialIncomeStatement(lines, '2026-01-01', '2026-12-31');
    expect(get(rows, 'TC').amount).toBe(1_000_000);
    expect(get(rows, 'RA').amount).toBe(-300_000);
    expect(get(rows, 'XB').amount).toBe(1_000_000); // chiffre d'affaires
    expect(get(rows, 'XC').amount).toBe(697_500); // valeur ajoutée
    expect(get(rows, 'XD').amount).toBe(497_500); // EBE
    expect(get(rows, 'XE').amount).toBe(-1_762_774); // résultat d'exploitation
    expect(result).toBe(-1_762_774);
    expect(unmapped).toEqual([]);
  });

  it('bilan équilibré, résultat non viré porté en CJ', () => {
    const { assets, liabilities } = officialBalanceSheet(lines, '2026-12-31');
    expect(get(assets, 'AN')).toMatchObject({ gross: 12_000_000, depreciation: 2_260_274, net: 9_739_726 });
    expect(get(assets, 'BI').net).toBe(492_500);
    expect(get(assets, 'BS').net).toBe(3_497_500);
    expect(get(liabilities, 'CJ').amount).toBe(-1_762_774);
    expect(get(liabilities, 'DH').amount).toBe(6_000_000);
    expect(get(assets, 'BZ').net).toBe(13_729_726);
    expect(get(liabilities, 'DZ').amount).toBe(get(assets, 'BZ').net);
  });

  it('tableau des flux : la variation calculée retombe sur la trésorerie réelle', () => {
    const { rows, actualCash, gap } = officialCashFlow(lines, '2026-01-01', '2026-12-31');
    expect(get(rows, 'FA').amount).toBe(497_500); // CAFG
    expect(get(rows, 'ZB').amount).toBe(6_497_500);
    expect(get(rows, 'ZC').amount).toBe(-12_000_000);
    expect(get(rows, 'ZF').amount).toBe(9_000_000);
    expect(get(rows, 'ZH').amount).toBe(3_497_500);
    expect(actualCash).toBe(3_497_500);
    expect(gap).toBe(0);
  });

  it('après clôture (6/7 virés au 131/139) : même bilan, même compte de résultat', () => {
    const closing = [
      { account: '601', entry_date: '2026-12-31', debit: 0, credit: 300_000, closing: true },
      { account: '631', entry_date: '2026-12-31', debit: 0, credit: 2_500, closing: true },
      { account: '661', entry_date: '2026-12-31', debit: 0, credit: 200_000, closing: true },
      { account: '681', entry_date: '2026-12-31', debit: 0, credit: 2_260_274, closing: true },
      { account: '706', entry_date: '2026-12-31', debit: 1_000_000, credit: 0, closing: true },
      { account: '139', entry_date: '2026-12-31', debit: 1_762_774, credit: 0, closing: true },
    ];
    const all = [...lines, ...closing];
    expect(officialIncomeStatement(all, '2026-01-01', '2026-12-31').result).toBe(-1_762_774);
    const { assets, liabilities } = officialBalanceSheet(all, '2026-12-31');
    expect(get(liabilities, 'CJ').amount).toBe(-1_762_774);
    expect(get(liabilities, 'DZ').amount).toBe(get(assets, 'BZ').net);
  });

  it('note sur les immobilisations : entrées et amortissements de l’exercice', () => {
    expect(fixedAssetsNote(lines, '2026-01-01', '2026-12-31')).toEqual([
      { ref: 'AN', grossOpen: 0, increases: 12_000_000, decreases: 0, grossClose: 12_000_000, depOpen: 0, depAdded: 2_260_274, depRemoved: 0, depClose: 2_260_274 },
    ]);
  });
});
