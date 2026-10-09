// Pagination côté serveur : chaque liste renvoie une page de PAGE_SIZE lignes et des
// métadonnées (total, nombre de pages, statistiques calculées en SQL sur toutes les données).

export const PAGE_SIZE = 20;

/** Taille d'une tranche quand il faut vraiment tout lire (calculs) : la limite de l'API Supabase. */
export const FETCH_CHUNK = 1000;

export type PageMeta<S = undefined> = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: S;
};

export type Paginated<T, S = undefined> = { items: T[]; meta: PageMeta<S> };

/** Numéro de page depuis un paramètre d'URL (?page=3) ; 1 par défaut ou si invalide. */
export function parsePage(value: string | string[] | undefined | null): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Bornes inclusives pour `.range(from, to)` de Supabase. */
export function pageRange(page: number, pageSize = PAGE_SIZE): [number, number] {
  const from = (Math.max(1, page) - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function buildMeta<S>(page: number, total: number, stats: S, pageSize = PAGE_SIZE): PageMeta<S> {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), stats };
}

export function emptyPage<T, S>(stats: S, page = 1): Paginated<T, S> {
  return { items: [], meta: buildMeta(page, 0, stats) };
}

/** Texte de recherche nettoyé pour un filtre `ilike` PostgREST (pas de virgule ni parenthèse, qui cassent `.or()`). */
export function searchTerm(value: string | string[] | undefined | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 80);
}

/**
 * Lit toutes les lignes d'une requête par tranches de FETCH_CHUNK (l'API coupe sans erreur
 * au-delà de sa limite). `build(from, to)` doit renvoyer la requête avec `.range(from, to)`
 * et un ordre stable.
 */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += FETCH_CHUNK) {
    const { data, error } = await build(from, from + FETCH_CHUNK - 1);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < FETCH_CHUNK) return rows;
  }
}

/**
 * Page au-delà de la fin (?page=99) : l'API renvoie l'erreur PGRST103 au lieu d'une liste vide.
 * On la transforme en page vide avec le vrai total (indiqué dans le détail de l'erreur).
 */
export async function settlePage<T>(
  query: PromiseLike<{ data: T[] | null; count: number | null; error: { code?: string; details?: string | null } | null }>,
): Promise<{ data: T[] | null; count: number | null; error: { code?: string; details?: string | null } | null }> {
  const result = await query;
  if (result.error?.code !== 'PGRST103') return result;
  const total = Number(/only (\d+) rows/.exec(result.error.details ?? '')?.[1] ?? 0);
  return { data: [], count: total, error: null };
}
