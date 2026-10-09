import { getAdminSupabase } from '@/lib/supabase';
import { isLicenseValid, isStructureVisible, STRUCTURE_LICENSE_SELECT } from '@/lib/license';

// Contrôle d'accès commun à toutes les connexions (mot de passe, code PIN du mode serveur).
// Module serveur interne : pas dans un fichier « use server », donc jamais appelable du navigateur.

export type AccessCheck = { ok: true } | { ok: false; reason: 'license_expired' | 'point_inactive' };

async function getOrganizationLicenseActive(organizationId: string) {
  const admin = getAdminSupabase();
  const { data: license } = await admin
    .from('licenses')
    .select('is_active, expires_at')
    .eq('organization_id', organizationId)
    .maybeSingle();
  return isLicenseValid(license);
}

/**
 * Vérifie que le compte peut accéder au back-office :
 * - staff d'un point : point actif + licence de l'organisation valide
 * - ORG_ADMIN : licence de l'organisation valide
 * - SUPER_ADMIN / CLIENT : pas de licence
 */
export async function checkAccountAccess(
  structureId: string | null | undefined,
  organizationId: string | null | undefined
): Promise<AccessCheck> {
  if (structureId) {
    const admin = getAdminSupabase();
    const { data: structure } = await admin
      .from('structures')
      .select(`is_active, ${STRUCTURE_LICENSE_SELECT}`)
      .eq('id', structureId)
      .maybeSingle();
    if (!structure) return { ok: false, reason: 'license_expired' };
    if (structure.is_active === false) return { ok: false, reason: 'point_inactive' };
    return isStructureVisible(structure) ? { ok: true } : { ok: false, reason: 'license_expired' };
  }

  if (organizationId) {
    return (await getOrganizationLicenseActive(organizationId))
      ? { ok: true }
      : { ok: false, reason: 'license_expired' };
  }

  return { ok: true };
}

export const ACCESS_ERROR_KEYS = {
  license_expired: 'auth.errors.licenseExpired',
  point_inactive: 'auth.errors.pointInactive',
} as const;
