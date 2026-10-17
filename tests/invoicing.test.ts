import { describe, expect, it } from 'vitest';
import { agingBucket, computeDocumentTotals, daysOverdue, dueDateFrom, paymentState, remainingDue } from '@/lib/invoicing';

describe('facturation : totaux', () => {
  it('HT, remise, TVA et TTC par ligne, arrondis à l’unité', () => {
    const t = computeDocumentTotals([
      { description: 'Audit', quantity: 2, unitPrice: 150000, taxRate: 19.25, nature: 'services' },
      { description: 'Clé USB', quantity: 3, unitPrice: 4999, discountPercent: 10, taxRate: 19.25, nature: 'goods' },
    ]);
    expect(t.lines[0].totalHt).toBe(300000);
    expect(t.lines[0].taxAmount).toBe(57750);
    expect(t.lines[1].totalHt).toBe(13497); // 3 × 4999 × 0,9 = 13 497,3
    expect(t.lines[1].taxAmount).toBe(2598); // 13 497 × 19,25 % = 2 598,2
    expect(t.subtotalHt).toBe(313497);
    expect(t.taxAmount).toBe(60348);
    expect(t.totalTtc).toBe(373845);
  });

  it('compte de produit et TVA collectée selon la nature de la ligne', () => {
    const t = computeDocumentTotals([
      { description: 'Conseil', quantity: 1, unitPrice: 1000, taxRate: 19.25, nature: 'services' },
      { description: 'Marchandise', quantity: 1, unitPrice: 1000, taxRate: 19.25, nature: 'goods' },
      { description: 'Chantier', quantity: 1, unitPrice: 1000, taxRate: 19.25, nature: 'works' },
    ]);
    expect(t.lines.map((l) => [l.account, l.vatAccount])).toEqual([
      ['706', '4432'],
      ['701', '4431'],
      ['704', '4432'],
    ]);
  });

  it('récapitulatif de TVA par taux (exonéré compris)', () => {
    const t = computeDocumentTotals([
      { description: 'A', quantity: 1, unitPrice: 10000, taxRate: 19.25 },
      { description: 'B', quantity: 1, unitPrice: 5000, taxRate: 0 },
      { description: 'C', quantity: 2, unitPrice: 1000, taxRate: 19.25 },
    ]);
    expect(t.taxByRate).toEqual([
      { rate: 19.25, base: 12000, tax: 1925 + 385 },
      { rate: 0, base: 5000, tax: 0 },
    ]);
  });

  it('valeurs hors limites ramenées dans les bornes', () => {
    const t = computeDocumentTotals([{ description: 'X', quantity: 1, unitPrice: 1000, discountPercent: 150, taxRate: -5 }]);
    expect(t.lines[0].totalHt).toBe(0);
    expect(t.lines[0].taxRate).toBe(0);
  });
});

describe('facturation : échéances et règlements', () => {
  it('échéance = émission + délai du client', () => {
    expect(dueDateFrom('2026-10-17', 30)).toBe('2026-11-16');
    expect(dueDateFrom('2026-12-15', 30)).toBe('2027-01-14');
    expect(dueDateFrom('2026-10-17', 0)).toBe('2026-10-17');
  });

  it('reste dû : total − encaissé − crédité par avoir', () => {
    expect(remainingDue({ total_ttc: 100000, amount_paid: 30000, amount_credited: 20000 })).toBe(50000);
    expect(paymentState({ total_ttc: 100000, amount_paid: 0 })).toBe('unpaid');
    expect(paymentState({ total_ttc: 100000, amount_paid: 30000 })).toBe('partial');
    expect(paymentState({ total_ttc: 100000, amount_paid: 80000, amount_credited: 20000 })).toBe('paid');
  });

  it('retard et balance âgée', () => {
    const doc = { due_date: '2026-09-01', total_ttc: 1000, amount_paid: 0 };
    expect(daysOverdue(doc, '2026-10-17')).toBe(46);
    expect(agingBucket(46)).toBe('d60');
    expect(daysOverdue({ ...doc, amount_paid: 1000 }, '2026-10-17')).toBe(0); // réglée
    expect(daysOverdue({ ...doc, due_date: '2026-11-01' }, '2026-10-17')).toBe(0); // pas encore échue
    expect(agingBucket(0)).toBe('current');
    expect(agingBucket(120)).toBe('over90');
  });
});
