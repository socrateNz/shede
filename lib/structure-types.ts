// Types de structure (points). ENTREPRISE : entreprise qui utilise Shede comme logiciel
// comptable, sans caisse ni hôtel — elle n'apparaît pas dans l'appli client.
export const STRUCTURE_TYPES = ['RESTAURANT', 'HOTEL', 'MIXTE', 'ENTREPRISE'] as const;
export type StructureType = (typeof STRUCTURE_TYPES)[number];

export function isStructureType(value: string): value is StructureType {
  return (STRUCTURE_TYPES as readonly string[]).includes(value);
}

/** Visible des clients (commande, réservation) : tout sauf les entreprises « comptabilité seule ». */
export function isCustomerFacingType(type: string | null | undefined) {
  return type !== 'ENTREPRISE';
}
