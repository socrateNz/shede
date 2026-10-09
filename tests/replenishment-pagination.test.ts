import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/forecast';
import { computeSuggestions, type ItemKey, type SupplierInfo, type SupplierOffer } from '@/lib/replenishment';
import { buildMeta, fetchAll, FETCH_CHUNK, pageRange, parsePage, searchTerm, settlePage } from '@/lib/pagination';

describe('Commandes suggérées (computeSuggestions)', () => {
  const today = '2026-10-12';
  const rice: ItemKey = 'ingredient:riz';
  // 4 plats par jour pendant 14 jours, 0,5 kg de riz par plat : 2 kg par jour
  const forecast = new Map(Array.from({ length: 14 }, (_, i) => [addDays(today, i), new Map([['plat', 4]])]));
  const usage = new Map([['plat', [{ key: rice, quantity: 0.5 }]]]);
  const supplier: SupplierInfo = { id: 's1', name: 'Marché central', deliveryDays: [], leadTimeDays: 0, minOrderAmount: 0 };
  const offer = (over: Partial<SupplierOffer> = {}): SupplierOffer => ({
    supplierItemId: 'si1',
    supplierId: 's1',
    key: rice,
    packLabel: 'Sac de 5 kg',
    packSize: 5,
    unitPrice: 1000,
    preferred: false,
    ...over,
  });

  it('commande de quoi tenir jusqu’à la livraison suivante, arrondi au conditionnement', () => {
    const [group] = computeSuggestions({
      today,
      forecast,
      usage,
      items: [{ key: rice, name: 'Riz', unit: 'kg', stock: 2, threshold: 1 }],
      offers: [offer()],
      suppliers: [supplier],
      incoming: new Map(),
    });
    // 7 jours × 2 kg + 1 kg de sécurité − 2 kg en stock = 13 kg → 3 sacs de 5 kg
    expect(group.supplier?.id).toBe('s1');
    expect(group.lines[0].need).toBe(13);
    expect(group.lines[0].packs).toBe(3);
    expect(group.total).toBe(3000);
  });

  it('déduit les quantités déjà commandées', () => {
    const [group] = computeSuggestions({
      today,
      forecast,
      usage,
      items: [{ key: rice, name: 'Riz', unit: 'kg', stock: 2, threshold: 1 }],
      offers: [offer()],
      suppliers: [supplier],
      incoming: new Map([[rice, 10]]),
    });
    expect(group.lines[0].need).toBe(3);
    expect(group.lines[0].packs).toBe(1);
  });

  it('ne propose rien quand le stock suffit', () => {
    const groups = computeSuggestions({
      today,
      forecast,
      usage,
      items: [{ key: rice, name: 'Riz', unit: 'kg', stock: 100, threshold: 1 }],
      offers: [offer()],
      suppliers: [supplier],
      incoming: new Map(),
    });
    expect(groups).toHaveLength(0);
  });

  it('préfère le fournisseur marqué préféré, même plus cher', () => {
    const second: SupplierInfo = { ...supplier, id: 's2', name: 'Grossiste' };
    const [group] = computeSuggestions({
      today,
      forecast,
      usage,
      items: [{ key: rice, name: 'Riz', unit: 'kg', stock: 2, threshold: 1 }],
      offers: [offer({ supplierItemId: 'a', unitPrice: 900 }), offer({ supplierItemId: 'b', supplierId: 's2', unitPrice: 1500, preferred: true })],
      suppliers: [supplier, second],
      incoming: new Map(),
    });
    expect(group.supplier?.id).toBe('s2');
  });

  it('signale une commande sous le minimum du fournisseur', () => {
    const [group] = computeSuggestions({
      today,
      forecast,
      usage,
      items: [{ key: rice, name: 'Riz', unit: 'kg', stock: 2, threshold: 1 }],
      offers: [offer()],
      suppliers: [{ ...supplier, minOrderAmount: 10000 }],
      incoming: new Map(),
    });
    expect(group.belowMinimum).toBe(true);
  });
});

describe('Pagination', () => {
  it('lit le numéro de page de l’URL', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('-2')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage(['4', '9'])).toBe(4);
  });

  it('bornes de la page (20 lignes)', () => {
    expect(pageRange(1)).toEqual([0, 19]);
    expect(pageRange(3)).toEqual([40, 59]);
  });

  it('nombre de pages', () => {
    expect(buildMeta(1, 0, null).totalPages).toBe(1);
    expect(buildMeta(1, 20, null).totalPages).toBe(1);
    expect(buildMeta(1, 21, null).totalPages).toBe(2);
  });

  it('nettoie la recherche (caractères qui cassent les filtres)', () => {
    expect(searchTerm('  poulet, (DG)%  ')).toBe('poulet   DG');
    expect(searchTerm(undefined)).toBe('');
  });

  it('page au-delà de la fin : page vide avec le vrai total', async () => {
    const result = await settlePage(
      Promise.resolve({
        data: null,
        count: null,
        error: { code: 'PGRST103', details: 'An offset of 1000 was requested, but there are only 26 rows.' },
      })
    );
    expect(result).toEqual({ data: [], count: 26, error: null });
  });

  it('lit toutes les lignes par tranches, au-delà de la limite de l’API', async () => {
    const total = FETCH_CHUNK * 2 + 37;
    const rows = await fetchAll((from, to) =>
      Promise.resolve({ data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i), error: null })
    );
    expect(rows).toHaveLength(total);
    expect(rows[total - 1]).toBe(total - 1);
  });
});
