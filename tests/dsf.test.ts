import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildDsf, DSF_LAYOUT, dsfCashAmount, dsfIncomeAmount, monthsBetween } from '@/lib/accounting/dsf';
import { fillTemplate, setCellInSheetXml } from '@/lib/xlsx-template';

const TEMPLATE = readFileSync(join(__dirname, '..', 'templates', 'dsf', 'dsf-systeme-normal.xlsx'));
const read = (file: Uint8Array) => XLSX.read(file, { type: 'buffer' });

// Petite entreprise, exercice 2026 (mêmes écritures que tests/syscohada.test.ts)
const e = (date: string, ...pairs: [string, number, number][]) => pairs.map(([account, debit, credit]) => ({ account, entry_date: date, debit, credit }));
const lines = [
  ...e('2026-01-02', ['521', 5_000_000, 0], ['101', 0, 5_000_000]),
  ...e('2026-04-01', ['245', 12_000_000, 0], ['481', 0, 12_000_000]),
  ...e('2026-04-10', ['481', 6_000_000, 0], ['521', 0, 6_000_000]),
  ...e('2026-05-01', ['411', 1_192_500, 0], ['706', 0, 1_000_000], ['4432', 0, 192_500]),
  ...e('2026-06-01', ['601', 300_000, 0], ['401', 0, 300_000]),
  ...e('2026-06-30', ['661', 200_000, 0], ['521', 0, 200_000]),
  ...e('2026-12-31', ['681', 2_260_274, 0], ['2845', 0, 2_260_274]),
];
const identity = { name: 'Restaurant Test SARL', niu: 'M012345678901A', rccm: 'RC/DLA/2026/B/123', address: 'Rue 1.234, Akwa', city: 'Douala', phone: '699000000' };
const input = { identity, lines, from: '2026-01-01', to: '2026-12-31', previousFrom: '2025-01-01', previousTo: '2025-12-31' };

describe('Modèle Excel — écriture dans les cellules', () => {
  it('remplit une cellule vide en gardant son style, crée une cellule et une ligne absentes', () => {
    const xml = '<worksheet><sheetData><row r="2"><c r="A2" s="5"/><c r="D2" s="7"/></row><row r="9"><c r="B9"/></row></sheetData></worksheet>';
    let out = setCellInSheetXml(xml, 'D2', 1500);
    expect(out).toContain('<c r="D2" s="7"><v>1500</v></c>');
    out = setCellInSheetXml(out, 'B2', 'Total & co');
    // Insérée entre A2 et D2, texte échappé
    expect(out).toMatch(/<c r="A2" s="5"\/><c r="B2" t="inlineStr"><is><t xml:space="preserve">Total &amp; co<\/t><\/is><\/c><c r="D2"/);
    out = setCellInSheetXml(out, 'C5', 3);
    expect(out.indexOf('<row r="5">')).toBeGreaterThan(out.indexOf('<row r="2"'));
    expect(out.indexOf('<row r="5">')).toBeLessThan(out.indexOf('<row r="9"'));
  });
});

describe('DSF — correspondances avec le modèle de la DGI', () => {
  const book = read(TEMPLATE);
  const text = (sheet: string, ref: string) => String(book.Sheets[sheet][ref]?.v ?? '').trim();

  it('toutes les feuilles utilisées existent', () => {
    for (const name of Object.values(DSF_LAYOUT.SHEETS)) expect(book.SheetNames).toContain(name);
  });

  it('chaque référence du bilan, du compte de résultat et des flux est sur la ligne prévue', () => {
    const { SHEETS, ASSET_ROWS, LIABILITY_ROWS, INCOME_ROWS, CASH_ROWS } = DSF_LAYOUT;
    // Le modèle nomme BC et DY ce que le SYSCOHADA révisé (et Shede) nomment BG et DV
    const alias: Record<string, string> = { BG: 'BC', DV: 'DY' };
    for (const [ref, row] of Object.entries(ASSET_ROWS)) expect(text(SHEETS.balance, `A${row}`)).toBe(alias[ref] ?? ref);
    for (const [ref, row] of Object.entries(LIABILITY_ROWS)) expect(text(SHEETS.balance, `H${row}`)).toBe(alias[ref] ?? ref);
    for (const [ref, row] of Object.entries(INCOME_ROWS)) expect(text(SHEETS.income, `A${row}`)).toBe(ref);
    for (const [ref, row] of Object.entries(CASH_ROWS)) expect(text(SHEETS.cash, `A${row}`)).toBe(ref);
  });
});

describe('DSF — montants', () => {
  it('charges et décaissements saisis en positif, totaux signés', () => {
    expect(dsfIncomeAmount('RA', -300_000)).toBe(300_000);
    expect(dsfIncomeAmount('TA', 1_000_000)).toBe(1_000_000);
    expect(dsfIncomeAmount('XA', -300_000)).toBe(-300_000);
    expect(dsfCashAmount('FF', -12_000_000)).toBe(12_000_000);
    expect(dsfCashAmount('ZC', -6_000_000)).toBe(-6_000_000);
    expect(monthsBetween('2026-01-01', '2026-12-31')).toBe(12);
    expect(monthsBetween('2026-07-01', '2026-12-31')).toBe(6);
  });

  it('fichier complet : montants, identité et en-têtes à leur place', () => {
    const dsf = buildDsf(input);
    expect(dsf.checks.balanced).toBe(true);
    const book = read(fillTemplate(TEMPLATE, dsf.edits, dsf.sharedText));
    const v = (sheet: string, ref: string) => book.Sheets[sheet][ref]?.v;
    const { SHEETS } = DSF_LAYOUT;

    // Bilan : matériel de transport (AN) brut, amortissement, net ; trésorerie ; totaux égaux
    expect(v(SHEETS.balance, 'D22')).toBe(12_000_000);
    expect(v(SHEETS.balance, 'E22')).toBe(2_260_274);
    expect(v(SHEETS.balance, 'F22')).toBe(9_739_726);
    expect(v(SHEETS.balance, 'F40')).toBe(v(SHEETS.balance, 'K40'));
    expect(v(SHEETS.balance, 'G40')).toBe(0); // pas d'exercice précédent

    // Compte de résultat : services vendus (TC), achats en positif (RA), résultat signé (XI)
    expect(v(SHEETS.income, 'E16')).toBe(1_000_000);
    expect(v(SHEETS.income, 'E12')).toBe(300_000);
    expect(v(SHEETS.income, 'E33')).toBe(200_000);
    expect(v(SHEETS.income, 'E52')).toBe(1_000_000 - 300_000 - 200_000 - 2_260_274);

    // Flux : acquisition du véhicule en décaissement positif (FG), trésorerie de clôture (ZH)
    expect(v(SHEETS.cash, 'E21')).toBe(12_000_000);
    expect(v(SHEETS.cash, 'E39')).toBe(5_000_000 - 6_000_000 - 200_000);

    // Notes 3A / 3C : matériel de transport
    expect(v(SHEETS.note3a, 'E26')).toBe(12_000_000);
    expect(v(SHEETS.note3a, 'J33')).toBe(12_000_000);
    expect(v(SHEETS.note3c, 'C25')).toBe(2_260_274);

    // Identité : en-tête de chaque page, page de garde, fiche R1
    expect(String(v(SHEETS.balance, 'A4'))).toBe('Désignation entité : Restaurant Test SARL          Exercice clos le 31-12-2026');
    expect(String(v(SHEETS.balance, 'A5'))).toContain('M012345678901A');
    expect(String(v(SHEETS.note3a, 'A3'))).toContain('Durée (en mois) : 12');
    expect(String(v(SHEETS.cover, 'A25'))).toBe('DENOMINATION SOCIALE : Restaurant Test SARL');
    expect(v(SHEETS.cover, 'C20')).toBe('31/12/2026');
    expect(v(SHEETS.r1, 'E15')).toBe('RC/DLA/2026/B/123');
    expect(String(v(SHEETS.r1, 'E9'))).toContain('01/01/2026');

    // Le reste du modèle est intact
    expect(book.SheetNames.length).toBe(read(TEMPLATE).SheetNames.length);
  }, 60_000); // lecture et écriture du modèle complet (2,6 Mo, 74 feuilles)
});
