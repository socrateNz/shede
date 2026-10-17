/** Comptes proposés pour un moyen de paiement : banques (52x) ou Mobile Money (55x) ; aucun pour les espèces. */
export function accountFamily(method: string): '52' | '55' | null {
  if (method === 'MOBILE') return '55';
  if (method === 'TRANSFER' || method === 'CARD' || method === 'CHEQUE') return '52';
  return null;
}
