// Lecture d'un relevé bancaire (CSV ou Excel déjà converti en tableau de cellules) :
// fonctions pures, sans dépendance au navigateur ni à la base.

export type Cell = string | number | boolean | Date | null | undefined;

export type ColumnMapping = {
  /** Index de la ligne d'en-tête (les données commencent juste après). */
  headerRow: number;
  date: number;
  label: number;
  reference?: number | null;
  /** Un seul montant signé, ou deux colonnes débit (sortie) / crédit (entrée). */
  amount?: number | null;
  debit?: number | null;
  credit?: number | null;
  /** Format des dates écrites en texte : jour/mois (relevés camerounais) ou mois/jour. */
  dayFirst?: boolean;
};

export type StatementRow = { date: string; label: string; reference: string | null; amount: number };

export type ParseResult = {
  rows: StatementRow[];
  /** Lignes ignorées (sans date ni montant : sous-totaux, soldes, lignes vides). */
  skipped: number;
  errors: { row: number; reason: 'date' | 'amount' }[];
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Date d'un relevé → AAAA-MM-JJ. Accepte Date, numéro de série Excel, 31/12/2026, 2026-12-31, 31.12.26… */
export function parseStatementDate(value: Cell, dayFirst = true): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === 'number') {
    // Numéro de série Excel (jours depuis le 30/12/1899), plage plausible 1990–2100
    if (value < 32874 || value > 73051) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const text = String(value).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(text);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const [day, month] = dayFirst ? [+m[1], +m[2]] : [+m[2], +m[1]];
    return validDate(year, month, day);
  }
  return null;
}

function validDate(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Montant d'un relevé → nombre. Gère « 1 234 567 », « 1.234,56 », « 1,234.56 », « -1 500 »,
 * « (1 500) » (négatif comptable), « 1 500 FCFA », « 1500- ».
 */
export function parseStatementAmount(value: Cell): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value).trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/-\s*$/.test(text)) {
    negative = true;
    text = text.replace(/-\s*$/, '');
  }
  if (/^\s*-/.test(text)) {
    negative = !negative;
    text = text.replace(/^\s*-/, '');
  }
  text = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(text)) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const decimalSep = lastComma > lastDot ? ',' : lastDot > lastComma ? '.' : null;
  if (decimalSep) {
    const decimals = text.length - text.lastIndexOf(decimalSep) - 1;
    const other = decimalSep === ',' ? '.' : ',';
    // « 1.234 » ou « 1,234 » (3 chiffres, un seul séparateur) : séparateur de milliers
    const onlyOne = !text.includes(other) && text.indexOf(decimalSep) === text.lastIndexOf(decimalSep);
    if (onlyOne && decimals === 3) text = text.split(decimalSep).join('');
    else text = text.split(other).join('').replace(decimalSep, '.');
  }
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

/** Première ligne qui ressemble à un en-tête : au moins 3 cellules de texte non vides. */
export function guessHeaderRow(table: Cell[][]): number {
  const index = table.slice(0, 30).findIndex((row) => row.filter((c) => typeof c === 'string' && c.trim() && !/^\d/.test(c.trim())).length >= 3);
  return index < 0 ? 0 : index;
}

const norm = (s: Cell) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Correspondance devinée d'après les intitulés (français et anglais). */
export function guessMapping(table: Cell[][]): ColumnMapping {
  const headerRow = guessHeaderRow(table);
  const header = (table[headerRow] ?? []).map(norm);
  const taken = new Set<number>();
  const find = (...patterns: RegExp[]) => {
    for (const p of patterns) {
      const i = header.findIndex((h, index) => !taken.has(index) && p.test(h));
      if (i >= 0) {
        taken.add(i);
        return i;
      }
    }
    return -1;
  };
  // Ordre important : la date d'abord (« Date opération » n'est pas le libellé)
  const date = find(/date.*(valeur|value)/, /^date/, /date/);
  const label = find(/libelle/, /description|designation/, /narration|details?/, /operation/);
  const reference = find(/ref/, /piece|cheque|n°/);
  const debit = find(/debit|retrait|sortie|withdraw/);
  const credit = find(/credit|depot|versement|entree|deposit/);
  const amount = find(/montant|amount|somme/);
  return {
    headerRow,
    date: date < 0 ? 0 : date,
    label: label < 0 ? 1 : label,
    reference: reference < 0 ? null : reference,
    debit: debit >= 0 && credit >= 0 ? debit : null,
    credit: debit >= 0 && credit >= 0 ? credit : null,
    amount: debit >= 0 && credit >= 0 ? null : amount < 0 ? null : amount,
    dayFirst: true,
  };
}

/** Lignes du relevé selon la correspondance des colonnes. */
export function parseStatement(table: Cell[][], mapping: ColumnMapping): ParseResult {
  const rows: StatementRow[] = [];
  const errors: ParseResult['errors'] = [];
  let skipped = 0;
  const twoColumns = mapping.debit != null && mapping.credit != null;

  table.slice(mapping.headerRow + 1).forEach((cells, i) => {
    const rowNumber = mapping.headerRow + 2 + i; // numéro de ligne affiché dans le tableur
    const rawDate = cells[mapping.date];
    let amount: number | null;
    if (twoColumns) {
      const out = parseStatementAmount(cells[mapping.debit!]);
      const inn = parseStatementAmount(cells[mapping.credit!]);
      amount = out || inn ? (inn ?? 0) - Math.abs(out ?? 0) : null;
    } else {
      amount = mapping.amount != null ? parseStatementAmount(cells[mapping.amount]) : null;
    }
    const isEmpty = cells.every((c) => c == null || String(c).trim() === '');
    if (isEmpty || ((rawDate == null || rawDate === '') && !amount)) {
      skipped++;
      return;
    }
    const date = parseStatementDate(rawDate, mapping.dayFirst ?? true);
    if (!date) {
      // Ligne de solde ou de total sans date : ignorée ; sinon erreur à signaler
      if (rawDate == null || rawDate === '') skipped++;
      else errors.push({ row: rowNumber, reason: 'date' });
      return;
    }
    if (amount == null || amount === 0) {
      // Ligne datée sans montant (solde, report) : ignorée ; montant présent mais illisible : erreur
      const amountCells = twoColumns ? [cells[mapping.debit!], cells[mapping.credit!]] : [mapping.amount != null ? cells[mapping.amount] : null];
      const written = amountCells.some((c) => c != null && String(c).trim() !== '' && amount == null);
      if (written) errors.push({ row: rowNumber, reason: 'amount' });
      else skipped++;
      return;
    }
    const reference = mapping.reference != null ? String(cells[mapping.reference] ?? '').trim() || null : null;
    rows.push({ date, label: String(cells[mapping.label] ?? '').trim().slice(0, 300) || '—', reference: reference?.slice(0, 120) ?? null, amount });
  });
  return { rows, skipped, errors };
}

/**
 * Clé anti-doublon : date, montant, libellé et référence, plus le rang parmi les lignes
 * identiques du même fichier (deux frais bancaires identiques le même jour restent deux lignes).
 */
export function dedupeKeys(rows: StatementRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = [r.date, r.amount.toFixed(2), norm(r.label).replace(/\s+/g, ' '), norm(r.reference)].join('|');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}|${n}`;
  });
}
