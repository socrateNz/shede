// Clôture d'exercice : écriture qui solde les comptes de gestion (calcul pur).

export type ClosingInputLine = { account: string; entry_date: string; debit: number; credit: number; closing?: boolean };

export const PROFIT_ACCOUNT = '131';
export const LOSS_ACCOUNT = '139';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Solde chaque compte de charges (6), de produits (7) et HAO (8) mouvementé sur l'exercice,
 * et porte la différence au résultat : bénéfice au crédit du 131, perte au débit du 139.
 * Les écritures de clôture déjà passées sont ignorées.
 */
export function closingEntryLines(lines: ClosingInputLine[], start: string, end: string) {
  const balances = new Map<string, number>();
  for (const l of lines) {
    if (l.closing || l.entry_date < start || l.entry_date > end) continue;
    if (!/^[678]/.test(l.account)) continue;
    balances.set(l.account, r2((balances.get(l.account) ?? 0) + Number(l.debit) - Number(l.credit)));
  }
  const entryLines: { account: string; debit?: number; credit?: number }[] = [];
  let net = 0; // somme des soldes (débit − crédit) : positive = perte
  for (const [account, balance] of [...balances.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!balance) continue;
    net = r2(net + balance);
    entryLines.push(balance > 0 ? { account, credit: balance } : { account, debit: -balance });
  }
  const result = r2(-net); // produits − charges
  if (result > 0) entryLines.push({ account: PROFIT_ACCOUNT, credit: result });
  else if (result < 0) entryLines.push({ account: LOSS_ACCOUNT, debit: -result });
  return { lines: entryLines, result };
}

/** Exercice suivant : du lendemain de la fin à la même date un an plus tard (12 mois). */
export function nextFiscalYear(previousEnd: string) {
  const start = new Date(`${previousEnd}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
