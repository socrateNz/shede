import { describe, expect, it } from 'vitest';
import { dedupeKeys, guessMapping, parseStatement, parseStatementAmount, parseStatementDate } from '@/lib/bank-import';
import { autoMatchPairs, findCombination, rankCandidates, reconciliationReport } from '@/lib/bank-reconciliation';

describe('relevé : dates', () => {
  it('formats courants des banques camerounaises et d’Excel', () => {
    expect(parseStatementDate('05/10/2026')).toBe('2026-10-05');
    expect(parseStatementDate('05-10-26')).toBe('2026-10-05');
    expect(parseStatementDate('2026-10-05')).toBe('2026-10-05');
    expect(parseStatementDate('05.10.2026 14:32')).toBe('2026-10-05');
    expect(parseStatementDate(46300)).toBe('2026-10-05'); // numéro de série Excel
    expect(parseStatementDate('10/05/2026', false)).toBe('2026-10-05'); // mois/jour
  });
  it('dates impossibles refusées', () => {
    expect(parseStatementDate('31/02/2026')).toBeNull();
    expect(parseStatementDate('Solde au')).toBeNull();
    expect(parseStatementDate(12)).toBeNull();
  });
});

describe('relevé : montants', () => {
  it('séparateurs français et anglais, signes', () => {
    expect(parseStatementAmount('1 234 567')).toBe(1234567);
    expect(parseStatementAmount('1 234,50')).toBe(1234.5);
    expect(parseStatementAmount('1.234,50')).toBe(1234.5);
    expect(parseStatementAmount('1,234.50')).toBe(1234.5);
    expect(parseStatementAmount('1.500')).toBe(1500); // milliers
    expect(parseStatementAmount('-25 000 FCFA')).toBe(-25000);
    expect(parseStatementAmount('(3 000)')).toBe(-3000);
    expect(parseStatementAmount('3 000-')).toBe(-3000);
    expect(parseStatementAmount(1500.257)).toBe(1500.257);
    expect(parseStatementAmount('')).toBeNull();
    expect(parseStatementAmount('—')).toBeNull();
  });
});

describe('relevé : lecture d’un fichier', () => {
  const table = [
    ['BANQUE ATLANTIQUE — Relevé de compte', null, null, null, null],
    ['Date opération', 'Libellé', 'Référence', 'Débit', 'Crédit'],
    ['01/10/2026', 'Solde initial', null, null, null],
    ['03/10/2026', 'VIR RECU SARL TEST FAC-2026-00001', 'VR123', '', '100 000'],
    ['05/10/2026', 'FRAIS TENUE DE COMPTE', null, '2 500', ''],
    ['05/10/2026', 'FRAIS TENUE DE COMPTE', null, '2 500', ''],
    [null, 'Total', null, '5 000', '100 000'],
    ['32/10/2026', 'Ligne abîmée', null, '10', ''],
  ];

  it('devine l’en-tête et les colonnes débit / crédit', () => {
    const m = guessMapping(table);
    expect(m.headerRow).toBe(1);
    expect([m.date, m.label, m.reference, m.debit, m.credit, m.amount]).toEqual([0, 1, 2, 3, 4, null]);
  });

  it('lit les mouvements, ignore soldes et totaux, signale les lignes illisibles', () => {
    const result = parseStatement(table, guessMapping(table));
    expect(result.rows).toEqual([
      { date: '2026-10-03', label: 'VIR RECU SARL TEST FAC-2026-00001', reference: 'VR123', amount: 100000 },
      { date: '2026-10-05', label: 'FRAIS TENUE DE COMPTE', reference: null, amount: -2500 },
      { date: '2026-10-05', label: 'FRAIS TENUE DE COMPTE', reference: null, amount: -2500 },
    ]);
    expect(result.errors).toEqual([{ row: 8, reason: 'date' }]);
  });

  it('deux lignes identiques le même jour gardent des clés différentes ; un réimport donne les mêmes clés', () => {
    const { rows } = parseStatement(table, guessMapping(table));
    const keys = dedupeKeys(rows);
    expect(new Set(keys).size).toBe(3);
    expect(dedupeKeys(rows)).toEqual(keys);
  });
});

describe('rapprochement', () => {
  const books = [
    { id: 'b1', entry_date: '2026-10-02', debit: 100000, credit: 0, label: 'Encaissement facture FAC-2026-00001 — SARL Test' },
    { id: 'b2', entry_date: '2026-10-20', debit: 100000, credit: 0, label: 'Encaissement facture FAC-2026-00007' },
    { id: 'b3', entry_date: '2026-10-05', debit: 0, credit: 2500, label: 'Frais bancaires' },
    { id: 'b4', entry_date: '2026-10-05', debit: 0, credit: 2500, label: 'Frais bancaires' },
  ];

  it('propose les écritures de même montant et même sens, la plus proche et la mieux libellée d’abord', () => {
    const line = { id: 'l1', value_date: '2026-10-03', amount: 100000, label: 'VIR RECU SARL TEST FAC-2026-00001', reference: null };
    const ranked = rankCandidates(line, books);
    expect(ranked.map((c) => c.id)).toEqual(['b1']); // b2 est à 17 jours : hors de la fenêtre de 15 jours
    expect(rankCandidates({ ...line, amount: -100000 }, books)).toEqual([]); // sens opposé
    // Deux candidats dans la fenêtre : le libellé commun (client, n° de facture) l'emporte sur 2 jours d'écart
    const later = { ...line, value_date: '2026-10-12' };
    expect(rankCandidates(later, books).map((c) => c.id)).toEqual(['b1', 'b2']);
  });

  it('rapprochement automatique seulement sans ambiguïté', () => {
    const lines = [
      { id: 'l1', value_date: '2026-10-03', amount: 100000, label: 'VIR', reference: null },
      { id: 'l2', value_date: '2026-10-05', amount: -2500, label: 'FRAIS', reference: null },
    ];
    // l1 : un seul candidat à ±5 jours (b2 est à 17 jours) ; l2 : deux candidats identiques → laissé à l'utilisateur
    expect(autoMatchPairs(lines, books)).toEqual([{ lineId: 'l1', bookId: 'b1' }]);
  });

  it('état de rapprochement équilibré', () => {
    const report = reconciliationReport({
      asOf: '2026-10-31',
      openingBalance: 50000,
      statementLines: [
        { value_date: '2026-10-03', amount: 100000, status: 'MATCHED' },
        { value_date: '2026-10-05', amount: -2500, status: 'UNMATCHED' }, // frais pas encore comptabilisés
      ],
      bookLines: [
        { entry_date: '2026-09-30', debit: 50000, credit: 0, reconciled: true }, // ouverture
        { entry_date: '2026-10-02', debit: 100000, credit: 0, reconciled: true },
        { entry_date: '2026-10-28', debit: 0, credit: 30000, reconciled: false }, // chèque émis, pas encore débité
      ],
    });
    expect(report.bankBalance).toBe(147500);
    expect(report.bookBalance).toBe(120000);
    expect(report.adjustedBank).toBe(117500); // 147 500 − 30 000
    expect(report.adjustedBook).toBe(117500); // 120 000 − 2 500
    expect(report.difference).toBe(0);
  });
});

describe('rapprochement groupé', () => {
  const books = [
    { id: 'c1', entry_date: '2026-10-10', debit: 45000, credit: 0, label: 'Chèque client A' },
    { id: 'c2', entry_date: '2026-10-11', debit: 30000, credit: 0, label: 'Chèque client B' },
    { id: 'c3', entry_date: '2026-10-11', debit: 25000, credit: 0, label: 'Chèque client C' },
    { id: 'c4', entry_date: '2026-10-12', debit: 12000, credit: 0, label: 'Chèque client D' },
    { id: 'p1', entry_date: '2026-10-11', debit: 0, credit: 75000, label: 'Paiement fournisseur' },
  ];

  it('trouve la remise de chèques qui fait le montant du relevé', () => {
    const line = { id: 'r', value_date: '2026-10-13', amount: 100000, label: 'REMISE CHEQUES', reference: null };
    expect(findCombination(line, books)?.map((b) => b.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('ignore le sens opposé et renvoie null sans combinaison exacte', () => {
    expect(findCombination({ id: 'r', value_date: '2026-10-13', amount: 99999, label: '', reference: null }, books)).toBeNull();
    // Une seule écriture suffit : ce n'est pas un regroupement (proposé par la recherche simple)
    expect(findCombination({ id: 'r', value_date: '2026-10-13', amount: 45000, label: '', reference: null }, books)).toBeNull();
    expect(findCombination({ id: 'r', value_date: '2026-10-13', amount: -75000, label: '', reference: null }, books)).toBeNull();
  });

  it('préfère la combinaison la plus courte', () => {
    const line = { id: 'r', value_date: '2026-10-13', amount: 55000, label: '', reference: null };
    // 30 000 + 25 000 : deux écritures suffisent (pas de combinaison à trois retenue)
    expect(findCombination(line, books)?.length).toBe(2);
  });
});
