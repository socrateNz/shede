/**
 * La licence appartient à l'organisation ; chaque point (structure) en hérite.
 * Ces helpers sont purs (pas d'accès BDD) pour être utilisables partout,
 * y compris sur des résultats de jointure Supabase.
 */

export interface LicenseLike {
  is_active?: boolean | null;
  expires_at?: string | null;
}

/** Supabase renvoie une relation 1-1 tantôt en objet, tantôt en tableau. */
export function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function isLicenseValid(license: LicenseLike | null | undefined): boolean {
  if (!license || license.is_active !== true) return false;
  if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
    return false;
  }
  return true;
}

/**
 * Sélection Supabase à utiliser sur `structures` pour pouvoir appeler
 * `isStructureVisible` sur le résultat.
 */
export const STRUCTURE_LICENSE_SELECT =
  'organizations!organization_id(licenses(is_active, expires_at))';

/** Un point est visible/utilisable s'il est actif et si la licence de son organisation est valide. */
export function isStructureVisible(structure: {
  is_active?: boolean | null;
  organizations?: unknown;
}): boolean {
  if (structure.is_active === false) return false;
  const organization = firstOf(
    structure.organizations as { licenses?: LicenseLike | LicenseLike[] } | null
  );
  return isLicenseValid(firstOf(organization?.licenses));
}
