// Rapprochement bancaire : propositions et état de rapprochement (calculs purs).

export type BankLine = { id: string; value_date: string; amount: number; label: string; reference: string | null };
export type BookLine = { id: string; entry_date: string; debit: number; credit: number; label: string; reference?: string | null; number?: string | null };

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;
const norm = (s: string | null | undefined) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Montant signé d'une ligne d'écriture sur le compte de banque : débit = entrée (+), crédit = sortie (−). */
export const bookAmount = (l: Pick<BookLine, 'debit' | 'credit'>) => Math.round((Number(l.debit) - Number(l.credit)) * 100) / 100;

/** Fenêtre de recherche autour de la date du relevé (délai d'encaissement d'un chèque, etc.). */
export const MATCH_WINDOW_DAYS = 15;

/**
 * Écritures candidates pour une ligne de relevé : même montant dans le même sens, à
 * ±15 jours, classées par score (date proche, référence ou libellé communs).
 */
export function rankCandidates(line: BankLine, candidates: BookLine[]) {
  const amount = Math.round(Number(line.amount) * 100) / 100;
  const words = new Set(norm(`${line.label} ${line.reference ?? ''}`).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
  return candidates
    .filter((c) => bookAmount(c) === amount && days(c.entry_date, line.value_date) <= MATCH_WINDOW_DAYS)
    .map((c) => {
      const gap = days(c.entry_date, line.value_date);
      const text = norm(`${c.label} ${c.reference ?? ''} ${c.number ?? ''}`);
      const refHit = Boolean(line.reference && text.includes(norm(line.reference))) || Boolean(c.reference && norm(`${line.label} ${line.reference}`).includes(norm(c.reference)));
      const common = [...words].filter((w) => text.includes(w)).length;
      const score = 100 - gap * 4 + (refHit ? 40 : 0) + Math.min(common, 3) * 8;
      return { ...c, gap, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Rapprochement automatique prudent : une ligne n'est rapprochée que si elle a exactement
 * un candidat à ±5 jours, et que ce candidat n'est revendiqué par aucune autre ligne.
 */
export function autoMatchPairs(lines: BankLine[], books: BookLine[], windowDays = 5): { lineId: string; bookId: string }[] {
  const proposals = lines.map((line) => ({
    line,
    candidates: rankCandidates(line, books).filter((c) => c.gap <= windowDays),
  }));
  const claims = new Map<string, number>();
  for (const p of proposals) for (const c of p.candidates) claims.set(c.id, (claims.get(c.id) ?? 0) + 1);
  return proposals
    .filter((p) => p.candidates.length === 1 && claims.get(p.candidates[0].id) === 1)
    .map((p) => ({ lineId: p.line.id, bookId: p.candidates[0].id }));
}

export type ReconciliationReport = {
  asOf: string;
  /** Solde du relevé : solde d'ouverture + mouvements importés jusqu'à la date. */
  bankBalance: number;
  /** Solde comptable du compte de trésorerie à la date. */
  bookBalance: number;
  /** En comptabilité, pas encore sur le relevé. */
  depositsInTransit: number; // entrées (débits)
  outstandingPayments: number; // sorties (crédits)
  /** Sur le relevé, pas encore en comptabilité. */
  unrecordedCredits: number; // entrées
  unrecordedDebits: number; // sorties
  adjustedBank: number;
  adjustedBook: number;
  difference: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * État de rapprochement : on corrige chaque solde de ce que l'autre côté contient déjà.
 *   solde banque + entrées comptabilisées non encore en banque − sorties comptabilisées non encore débitées
 * = solde comptable + entrées du relevé non comptabilisées − sorties du relevé non comptabilisées
 */
export function reconciliationReport(input: {
  asOf: string;
  openingBalance: number;
  statementLines: { value_date: string; amount: number; status: string }[];
  bookLines: { entry_date: string; debit: number; credit: number; reconciled: boolean }[];
}): ReconciliationReport {
  const { asOf } = input;
  const statement = input.statementLines.filter((l) => l.value_date <= asOf && l.status !== 'IGNORED');
  const books = input.bookLines.filter((l) => l.entry_date <= asOf);
  const bankBalance = r2(Number(input.openingBalance) + statement.reduce((s, l) => s + Number(l.amount), 0));
  const bookBalance = r2(books.reduce((s, l) => s + bookAmount(l), 0));
  const openBooks = books.filter((l) => !l.reconciled);
  const depositsInTransit = r2(openBooks.reduce((s, l) => s + Number(l.debit), 0));
  const outstandingPayments = r2(openBooks.reduce((s, l) => s + Number(l.credit), 0));
  const openStatement = statement.filter((l) => l.status === 'UNMATCHED');
  const unrecordedCredits = r2(openStatement.filter((l) => l.amount > 0).reduce((s, l) => s + Number(l.amount), 0));
  const unrecordedDebits = r2(openStatement.filter((l) => l.amount < 0).reduce((s, l) => s - Number(l.amount), 0));
  const adjustedBank = r2(bankBalance + depositsInTransit - outstandingPayments);
  const adjustedBook = r2(bookBalance + unrecordedCredits - unrecordedDebits);
  return {
    asOf,
    bankBalance,
    bookBalance,
    depositsInTransit,
    outstandingPayments,
    unrecordedCredits,
    unrecordedDebits,
    adjustedBank,
    adjustedBook,
    difference: r2(adjustedBank - adjustedBook),
  };
}

/**
 * Plusieurs écritures pour une ligne de relevé (ex. une remise de chèques) : cherche des
 * écritures de même sens, dans la fenêtre de dates, dont la somme égale le montant.
 * Recherche bornée (au plus 25 candidats, 20 000 essais) : renvoie la combinaison la plus
 * courte trouvée, les écritures les plus proches en date d'abord, ou null.
 */
export function findCombination(line: BankLine, candidates: BookLine[], maxNodes = 20_000): BookLine[] | null {
  const target = Math.round(Math.abs(Number(line.amount)) * 100);
  const sameSense = candidates
    .filter((c) => (line.amount > 0 ? Number(c.debit) > 0 && !Number(c.credit) : Number(c.credit) > 0 && !Number(c.debit)))
    .map((c) => ({ c, cents: Math.round(Math.abs(bookAmount(c)) * 100), gap: days(c.entry_date, line.value_date) }))
    .filter((x) => x.cents > 0 && x.cents <= target && x.gap <= MATCH_WINDOW_DAYS)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 25)
    .sort((a, b) => b.cents - a.cents);
  const suffix = sameSense.map((_, i) => sameSense.slice(i).reduce((s, x) => s + x.cents, 0));
  let nodes = 0;
  let best: number[] | null = null;
  const pick: number[] = [];
  const walk = (i: number, remaining: number) => {
    if (remaining === 0) {
      if (!best || pick.length < best.length) best = [...pick];
      return;
    }
    if (i >= sameSense.length || ++nodes > maxNodes || suffix[i] < remaining || (best && pick.length + 1 >= best.length)) return;
    if (sameSense[i].cents <= remaining) {
      pick.push(i);
      walk(i + 1, remaining - sameSense[i].cents);
      pick.pop();
    }
    walk(i + 1, remaining);
  };
  walk(0, target);
  const found = best as number[] | null;
  return found && found.length > 1 ? found.map((i) => sameSense[i].c) : null;
}
