// Immobilisations : catégories SYSCOHADA et amortissement linéaire prorata temporis (calculs purs).

/** Catégories : compte d'immobilisation, compte d'amortissement, durée d'usage courante (mois). */
export const ASSET_CATEGORIES = {
  software: { asset: '213', depreciation: '2813', months: 36 },
  land: { asset: '221', depreciation: null, months: 0 }, // terrain : non amortissable
  buildings: { asset: '231', depreciation: '2831', months: 240 },
  fittings: { asset: '234', depreciation: '2834', months: 120 },
  equipment: { asset: '241', depreciation: '2841', months: 60 },
  office: { asset: '244', depreciation: '2844', months: 60 },
  it: { asset: '244', depreciation: '2844', months: 36 },
  vehicles: { asset: '245', depreciation: '2845', months: 48 },
} as const;
export type AssetCategory = keyof typeof ASSET_CATEGORIES;
export const ASSET_CATEGORY_KEYS = Object.keys(ASSET_CATEGORIES) as AssetCategory[];

export type DepreciableAsset = { cost: number; in_service_date: string; useful_life_months: number };

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Fin d'amortissement : mise en service + durée (le bien est entièrement amorti la veille). */
export function depreciationEnd(asset: DepreciableAsset) {
  const d = new Date(toTime(asset.in_service_date));
  d.setUTCMonth(d.getUTCMonth() + Number(asset.useful_life_months));
  return d.toISOString().slice(0, 10);
}

/**
 * Amortissements cumulés au `asOf` inclus : annuité (coût × 12 / durée) au prorata des jours
 * écoulés depuis la mise en service, plafonnée au coût. Arrondi à l'unité (FCFA).
 */
export function cumulativeDepreciation(asset: DepreciableAsset, asOf: string) {
  const cost = Number(asset.cost) || 0;
  const months = Number(asset.useful_life_months) || 0;
  if (months <= 0 || asOf < asset.in_service_date) return 0;
  if (asOf >= depreciationEnd(asset)) return Math.round(cost);
  const days = Math.round((toTime(asOf) - toTime(asset.in_service_date)) / DAY) + 1;
  const annual = (cost * 12) / months;
  return Math.min(Math.round(cost), Math.round((annual * days) / 365));
}

export function netBookValue(asset: DepreciableAsset, asOf: string) {
  return Math.round(Number(asset.cost)) - cumulativeDepreciation(asset, asOf);
}

export type ScheduleRow = { year: number; opening: number; depreciation: number; cumulative: number; closing: number };

/** Plan d'amortissement par année civile, de la mise en service à l'amortissement complet. */
export function depreciationSchedule(asset: DepreciableAsset): ScheduleRow[] {
  const months = Number(asset.useful_life_months) || 0;
  if (months <= 0) return [];
  const cost = Math.round(Number(asset.cost));
  const first = Number(asset.in_service_date.slice(0, 4));
  const last = Number(depreciationEnd(asset).slice(0, 4));
  const rows: ScheduleRow[] = [];
  let previous = 0;
  for (let year = first; year <= last; year++) {
    const cumulative = cumulativeDepreciation(asset, `${year}-12-31`);
    const depreciation = cumulative - previous;
    if (depreciation > 0) rows.push({ year, opening: cost - previous, depreciation, cumulative, closing: cost - cumulative });
    previous = cumulative;
    if (cumulative >= cost) break;
  }
  return rows;
}
