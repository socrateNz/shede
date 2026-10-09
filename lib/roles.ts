import type { UserRole } from './auth';

/** Rôles d'un membre d'équipe d'un point (création de compte, filtre de la liste). */
export const TEAM_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR', 'RECEPTION', 'CUISINIER', 'BAR', 'LIVREUR', 'COMPTABLE', 'MAGASINIER', 'RH'];
