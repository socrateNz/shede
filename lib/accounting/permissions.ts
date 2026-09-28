/**
 * Droits du module Comptabilité.
 * - Écritures, plan comptable, clôture : administrateur et comptable du point.
 * - Saisie des dépenses : aussi le manager.
 * - États et rapports : administrateur, comptable, et l'administrateur
 *   d'organisation (lecture seule, consolidé sur ses points).
 */
export const ACCOUNTING_MODULE = 'COMPTABILITE';

export function canPostEntries(role: string) {
  return role === 'ADMIN' || role === 'COMPTABLE';
}

export function canRecordExpenses(role: string) {
  return role === 'ADMIN' || role === 'COMPTABLE' || role === 'MANAGER';
}

export function canViewReports(role: string) {
  return role === 'ADMIN' || role === 'COMPTABLE' || role === 'ORG_ADMIN';
}

export const ACCOUNTING_ROLES = ['ADMIN', 'COMPTABLE', 'MANAGER', 'ORG_ADMIN'] as const;
