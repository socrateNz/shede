import { describe, expect, it } from 'vitest';
import { addDays, buildForecast, cameroonHolidays, holidayOf, localToday, measureAccuracy, weekdayOf, type SalesRow } from '@/lib/forecast';

// Lundi : la semaine de prévision (12 → 18 octobre 2026) ne contient aucun jour férié.
const TODAY = '2026-10-12';
const PRODUCT = { id: 'p1', name: 'Poulet DG', price: 500 };

/** Historique de 8 semaines : quantité vendue par jour, 500 F l'unité. */
function history(qty: (day: string) => number): SalesRow[] {
  const rows: SalesRow[] = [];
  for (let day = addDays(TODAY, -56); day < TODAY; day = addDays(day, 1)) {
    const q = qty(day);
    if (q > 0) rows.push({ day, product_id: PRODUCT.id, quantity: q, revenue: q * 500 });
  }
  return rows;
}

describe('Dates', () => {
  it('passe les fins de mois et d’année', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('jour de semaine ISO', () => {
    expect(weekdayOf('2026-10-12')).toBe(1);
    expect(weekdayOf('2026-10-11')).toBe(7);
  });
  it('date du jour à Douala', () => {
    expect(localToday(new Date('2026-10-09T23:30:00Z'))).toBe('2026-10-10');
  });
});

describe('Jours fériés du Cameroun', () => {
  it('dates fixes', () => {
    expect(holidayOf('2026-05-20')).toBe('nationalDay');
    expect(holidayOf('2026-02-11')).toBe('youthDay');
    expect(holidayOf('2026-05-21')).toBeNull();
  });
  it('fêtes liées à Pâques (Pâques 2026 : 5 avril, 2027 : 28 mars)', () => {
    expect(cameroonHolidays(2026)['2026-04-03']).toBe('goodFriday');
    expect(cameroonHolidays(2026)['2026-05-14']).toBe('ascension');
    expect(cameroonHolidays(2027)['2027-03-26']).toBe('goodFriday');
  });
});

describe('Prévisions (buildForecast)', () => {
  it('ventes stables : la prévision reprend le rythme habituel', () => {
    const { days, trend } = buildForecast({ today: TODAY, horizon: 7, history: history(() => 10), products: [PRODUCT], events: [] });
    expect(trend).toBe(1);
    expect(days).toHaveLength(7);
    for (const day of days) {
      expect(day.quantity).toBe(10);
      expect(day.revenue).toBe(5000);
    }
  });

  it('un jour habituellement fermé est prévu à 0', () => {
    const closedSunday = history((day) => (weekdayOf(day) === 7 ? 0 : 10));
    const { days } = buildForecast({ today: TODAY, horizon: 7, history: closedSunday, products: [PRODUCT], events: [] });
    expect(days.find((d) => weekdayOf(d.date) === 7)!.quantity).toBe(0);
    expect(days.find((d) => weekdayOf(d.date) === 1)!.quantity).toBe(10);
  });

  it('un événement saisi modifie la prévision du jour', () => {
    const { days } = buildForecast({
      today: TODAY,
      horizon: 7,
      history: history(() => 10),
      products: [PRODUCT],
      events: [{ date: '2026-10-13', label: 'Match', impact: 50 }],
    });
    expect(days.find((d) => d.date === '2026-10-13')!.quantity).toBe(15);
    expect(days.find((d) => d.date === '2026-10-14')!.quantity).toBe(10);
  });

  it('tendance : +20 % sur 4 semaines, plafonnée puis amortie de moitié', () => {
    const growing = history((day) => (day >= addDays(TODAY, -28) ? 12 : 10));
    const { days, trend } = buildForecast({ today: TODAY, horizon: 1, history: growing, products: [PRODUCT], events: [] });
    expect(trend).toBeCloseTo(1.1);
    // Moyenne pondérée des 8 derniers lundis (poids 8 → 1) : 412 / 36, × 1,1
    expect(days[0].quantity).toBe(12.6);
  });

  it('sans historique, rien n’est prévu', () => {
    const { days } = buildForecast({ today: TODAY, horizon: 3, history: [], products: [PRODUCT], events: [] });
    expect(days.every((d) => d.quantity === 0)).toBe(true);
  });
});

describe('Fiabilité des prévisions (1 − WAPE)', () => {
  it('écart produit par produit rapporté au volume réel', () => {
    const snapshots = [
      { date: '2026-10-05', product_id: 'a', quantity: 10, revenue: 5000 },
      { date: '2026-10-05', product_id: 'b', quantity: 0, revenue: 0 },
    ];
    const actuals: SalesRow[] = [
      { day: '2026-10-05', product_id: 'a', quantity: 8, revenue: 4000 },
      { day: '2026-10-05', product_id: 'b', quantity: 2, revenue: 1000 },
    ];
    // Erreurs 2 + 2 sur 10 vendus : 60 %
    expect(measureAccuracy(snapshots, actuals).accuracy).toBe(60);
  });

  it('ignore les jours sans prévision et renvoie null sans ventes', () => {
    const snapshots = [{ date: '2026-10-05', product_id: 'a', quantity: 5, revenue: 2500 }];
    const actuals: SalesRow[] = [{ day: '2026-10-06', product_id: 'a', quantity: 9, revenue: 4500 }];
    expect(measureAccuracy(snapshots, actuals).accuracy).toBeNull();
  });
});
