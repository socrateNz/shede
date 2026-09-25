/**
 * Rôles qu'un administrateur de point peut attribuer à son personnel.
 * Même liste que la validation serveur de app/actions/users.ts : la création et la
 * modification d'un membre doivent proposer tous ces rôles, sinon le formulaire
 * d'édition retomberait sur le premier rôle de la liste à l'enregistrement.
 */
export const STAFF_ROLES = [
  { value: 'ADMIN', icon: '👑' },
  { value: 'MANAGER', icon: '🎯' },
  { value: 'CAISSE', icon: '💳' },
  { value: 'SERVEUR', icon: '🍽️' },
  { value: 'RECEPTION', icon: '🏨' },
  { value: 'CUISINIER', icon: '🍳' },
  { value: 'BAR', icon: '🍺' },
  { value: 'LIVREUR', icon: '🛵' },
  { value: 'COMPTABLE', icon: '📊' },
  { value: 'MAGASINIER', icon: '📦' },
  { value: 'RH', icon: '👥' },
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number]['value'];

export function staffRoleIcon(role: string) {
  return STAFF_ROLES.find((r) => r.value === role)?.icon ?? '👤';
}
