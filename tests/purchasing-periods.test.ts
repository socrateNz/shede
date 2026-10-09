import { describe, expect, it } from 'vitest';
import { isoWeekday, nextDeliveryDate, whatsappLink } from '@/lib/purchasing';
import { parsePeriod, periodRange } from '@/lib/periods';

describe('Livraisons fournisseurs', () => {
  it('numérote les jours du lundi (1) au dimanche (7)', () => {
    expect(isoWeekday(new Date('2026-10-12T12:00:00Z'))).toBe(1);
    expect(isoWeekday(new Date('2026-10-11T12:00:00Z'))).toBe(7);
  });

  it('livraison à la demande : le jour même', () => {
    expect(nextDeliveryDate([], 0, new Date('2026-10-09T10:00:00Z'))).toBe('2026-10-09');
  });

  it('respecte le délai puis le premier jour de livraison', () => {
    // Vendredi + 2 jours de délai = dimanche ; livre le lundi
    expect(nextDeliveryDate([1], 2, new Date('2026-10-09T10:00:00Z'))).toBe('2026-10-12');
  });

  it('raisonne en heure du Cameroun (23 h 30 UTC = le lendemain à Douala)', () => {
    expect(nextDeliveryDate([], 0, new Date('2026-10-09T23:30:00Z'))).toBe('2026-10-10');
  });
});

describe('Lien WhatsApp', () => {
  it('ajoute l’indicatif 237 à un numéro camerounais à 9 chiffres', () => {
    expect(whatsappLink('6 56 95 44 74', 'Bonjour à vous')).toBe('https://wa.me/237656954474?text=Bonjour%20%C3%A0%20vous');
  });
  it('garde un numéro international complet', () => {
    expect(whatsappLink('+237 656954474', 'x')).toBe('https://wa.me/237656954474?text=x');
  });
});

describe('Périodes des rapports (jours civils à Douala, UTC+1)', () => {
  const now = new Date('2026-10-09T10:00:00Z');

  it('période inconnue : 30 jours', () => {
    expect(parsePeriod('n_importe_quoi')).toBe('d30');
    expect(parsePeriod(['d7'])).toBe('d7');
  });

  it('mois en cours : du 1er à minuit (Douala) jusqu’à demain', () => {
    expect(periodRange('month', now)).toEqual({ from: '2026-09-30T23:00:00.000Z', to: '2026-10-09T23:00:00.000Z' });
  });

  it('mois précédent : bornes du mois complet', () => {
    expect(periodRange('lastMonth', now)).toEqual({ from: '2026-08-31T23:00:00.000Z', to: '2026-09-30T23:00:00.000Z' });
  });

  it('7 jours : aujourd’hui compris', () => {
    expect(periodRange('d7', now).from).toBe('2026-10-02T23:00:00.000Z');
  });

  it('à 23 h 30 UTC le 31 octobre, on est déjà en novembre à Douala', () => {
    expect(periodRange('month', new Date('2026-10-31T23:30:00Z')).from).toBe('2026-10-31T23:00:00.000Z');
  });
});
