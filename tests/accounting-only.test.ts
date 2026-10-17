import { describe, expect, it } from 'vitest';
import { isAccountingOnly, sanitizeModules } from '@/lib/modules';
import { isCustomerFacingType, isStructureType } from '@/lib/structure-types';

describe('offre « Comptabilité seule »', () => {
  it('la comptabilité sans module d’exploitation est une licence comptabilité seule', () => {
    expect(isAccountingOnly(['COMPTABILITE'])).toBe(true);
    // RH et CRM ne sont pas de l'exploitation : l'entreprise peut gérer son équipe et ses clients
    expect(isAccountingOnly(['COMPTABILITE', 'RH', 'CRM'])).toBe(true);
  });

  it('dès qu’il y a une caisse, un hôtel ou du stock, ce n’est plus le cas', () => {
    expect(isAccountingOnly(['COMPTABILITE', 'POS'])).toBe(false);
    expect(isAccountingOnly(['COMPTABILITE', 'HOTEL'])).toBe(false);
    expect(isAccountingOnly(sanitizeModules(['COMPTABILITE', 'ACHATS']))).toBe(false); // ACHATS ajoute STOCK
    expect(isAccountingOnly(['POS'])).toBe(false);
    expect(isAccountingOnly([])).toBe(false);
    expect(isAccountingOnly(undefined)).toBe(false);
  });

  it('une licence vide reste une caisse par défaut', () => {
    expect(sanitizeModules([])).toEqual(['POS']);
  });

  it('le type Entreprise est valide mais invisible dans l’appli client', () => {
    expect(isStructureType('ENTREPRISE')).toBe(true);
    expect(isStructureType('BOUTIQUE')).toBe(false);
    expect(isCustomerFacingType('ENTREPRISE')).toBe(false);
    expect(isCustomerFacingType('RESTAURANT')).toBe(true);
    expect(isCustomerFacingType(null)).toBe(true);
  });
});
