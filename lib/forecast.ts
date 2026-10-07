// Prévisions de ventes (module PREVISIONS) — fonctions pures, sans base.
//
// Méthode, volontairement simple et explicable :
// 1. base = moyenne des 8 derniers mêmes jours de semaine, pondérée (le plus
//    récent pèse 8, le plus ancien 1), sur les seuls jours « normaux » : jours
//    d'ouverture (au moins une vente), hors jours fériés et hors événements ;
// 2. tendance = ventes des 4 dernières semaines rapportées aux 4 précédentes,
//    jour de semaine par jour de semaine (insensible au mélange des jours),
//    bornée à ±20 % puis amortie de moitié ;
//    un jour de semaine habituellement fermé est prévu à 0 ;
// 3. événement du jour (match, fête, fermeture) : impact en %.
// La fiabilité se mesure en comparant prévisions conservées et ventes réelles.

export type SalesRow = { day: string; product_id: string; quantity: number; revenue: number };
export type ForecastProduct = { id: string; name: string; price: number };
export type ForecastEvent = { date: string; label: string; impact: number };

export const HISTORY_WEEKS = 8;
const TREND_CLAMP = 0.2;
const TREND_DAMPING = 0.5;

// ── Dates locales (YYYY-MM-DD) ───────────────────────────

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Jour ISO : 1 = lundi … 7 = dimanche. */
export function weekdayOf(day: string) {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Date du jour au Cameroun (UTC+1). */
export function localToday(now = new Date()) {
  return new Date(now.getTime() + 3600_000).toISOString().slice(0, 10);
}

/** Dimanche de Pâques (algorithme grégorien anonyme). */
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Jours fériés du Cameroun à date fixe ou liés à Pâques. Les fêtes musulmanes
 * (dates lunaires) se saisissent comme événements.
 */
export function cameroonHolidays(year: number): Record<string, string> {
  const easter = easterSunday(year);
  return {
    [`${year}-01-01`]: 'newYear',
    [`${year}-02-11`]: 'youthDay',
    [addDays(easter, -2)]: 'goodFriday',
    [`${year}-05-01`]: 'labourDay',
    [`${year}-05-20`]: 'nationalDay',
    [addDays(easter, 39)]: 'ascension',
    [`${year}-08-15`]: 'assumption',
    [`${year}-12-25`]: 'christmas',
  };
}

export function holidayOf(day: string): string | null {
  return cameroonHolidays(Number(day.slice(0, 4)))[day] ?? null;
}

// ── Prévision ────────────────────────────────────────────

export type DayForecast = {
  date: string;
  holiday: string | null;
  event: ForecastEvent | null;
  products: { product_id: string; quantity: number; revenue: number }[];
  quantity: number;
  revenue: number;
};

export function buildForecast(input: {
  today: string;
  horizon: number;
  history: SalesRow[];
  products: ForecastProduct[];
  events: ForecastEvent[];
}): { days: DayForecast[]; trend: number; openDays: number } {
  const byDay = new Map<string, Map<string, SalesRow>>();
  for (const row of input.history) {
    if (!byDay.has(row.day)) byDay.set(row.day, new Map());
    byDay.get(row.day)!.set(row.product_id, row);
  }
  const eventOf = new Map(input.events.map((e) => [e.date, e]));

  // Jours « normaux » de l'historique : au moins une vente, pas férié, pas d'événement
  const historyStart = addDays(input.today, -HISTORY_WEEKS * 7);
  // Premier jour de vente connu : avant, le restaurant n'utilisait pas encore Shede
  const firstSalesDay = [...byDay.keys()].filter((d) => d >= historyStart).sort()[0] ?? input.today;
  const normalDays = new Set<string>();
  for (let day = historyStart; day < input.today; day = addDays(day, 1)) {
    const sales = byDay.get(day);
    const sold = sales ? [...sales.values()].some((r) => r.quantity > 0) : false;
    if (sold && !holidayOf(day) && !eventOf.has(day)) normalDays.add(day);
  }

  // Tendance : pour chaque jour de semaine, moyenne des 4 dernières semaines rapportée
  // aux 4 précédentes ; moyenne de ces rapports pondérée par le volume ancien.
  const revenueOf = (day: string) => [...(byDay.get(day)?.values() ?? [])].reduce((s, r) => s + r.revenue, 0);
  const weekdayAverage = (weekday: number, from: string, to: string) => {
    const days = [...normalDays].filter((d) => d >= from && d < to && weekdayOf(d) === weekday);
    return days.length ? days.reduce((s, d) => s + revenueOf(d), 0) / days.length : null;
  };
  let weightedRatio = 0;
  let weightTotal = 0;
  for (let weekday = 1; weekday <= 7; weekday++) {
    const recent = weekdayAverage(weekday, addDays(input.today, -28), input.today);
    const previous = weekdayAverage(weekday, addDays(input.today, -56), addDays(input.today, -28));
    if (recent === null || previous === null || previous <= 0) continue;
    weightedRatio += (recent / previous) * previous;
    weightTotal += previous;
  }
  let trend = 1;
  if (weightTotal > 0) {
    const raw = Math.min(1 + TREND_CLAMP, Math.max(1 - TREND_CLAMP, weightedRatio / weightTotal));
    trend = 1 + (raw - 1) * TREND_DAMPING;
  }

  // Prix moyen réellement encaissé par produit (sinon prix catalogue)
  const unitRevenue = new Map<string, number>();
  const totals = new Map<string, { q: number; r: number }>();
  for (const row of input.history) {
    const t = totals.get(row.product_id) ?? { q: 0, r: 0 };
    t.q += row.quantity;
    t.r += row.revenue;
    totals.set(row.product_id, t);
  }
  totals.forEach((t, id) => t.q > 0 && unitRevenue.set(id, t.r / t.q));

  const days: DayForecast[] = [];
  for (let i = 0; i < input.horizon; i++) {
    const date = addDays(input.today, i);
    const weekday = weekdayOf(date);
    const event = eventOf.get(date) ?? null;
    const factor = trend * (event ? 1 + event.impact / 100 : 1);

    // Mêmes jours de semaine passés (depuis le premier jour de vente), hors fériés et événements
    const candidates: { day: string; weight: number }[] = [];
    for (let k = 1; k <= HISTORY_WEEKS; k++) {
      const day = addDays(date, -7 * k);
      if (day < input.today && day >= firstSalesDay && !holidayOf(day) && !eventOf.has(day)) {
        candidates.push({ day, weight: HISTORY_WEEKS + 1 - k });
      }
    }
    const sameDays = candidates.filter((c) => normalDays.has(c.day));
    // Ce jour de semaine est habituellement fermé (moins de la moitié des fois ouvert) : 0.
    const usuallyClosed = candidates.length >= 2 && sameDays.length * 2 < candidates.length;
    // Historique trop court pour ce jour : tous les jours normaux des 4 dernières semaines
    const sample = usuallyClosed
      ? []
      : sameDays.length >= 2
        ? sameDays
        : [...normalDays].filter((d) => d >= addDays(input.today, -28)).map((day) => ({ day, weight: 1 }));
    const weightSum = sample.reduce((s, x) => s + x.weight, 0);

    const products = input.products.map((p) => {
      const base = weightSum > 0 ? sample.reduce((s, x) => s + x.weight * (byDay.get(x.day)?.get(p.id)?.quantity ?? 0), 0) / weightSum : 0;
      const quantity = Math.round(Math.max(0, base * factor) * 10) / 10;
      return { product_id: p.id, quantity, revenue: Math.round(quantity * (unitRevenue.get(p.id) ?? p.price)) };
    });
    days.push({
      date,
      holiday: holidayOf(date),
      event,
      products,
      quantity: Math.round(products.reduce((s, p) => s + p.quantity, 0) * 10) / 10,
      revenue: products.reduce((s, p) => s + p.revenue, 0),
    });
  }
  return { days, trend, openDays: normalDays.size };
}

// ── Fiabilité ────────────────────────────────────────────

export type AccuracyDay = { date: string; forecastRevenue: number; actualRevenue: number };

/**
 * Fiabilité = 1 − WAPE, calculée produit par produit et jour par jour :
 * Σ |réel − prévu| / Σ réel. Seuls les jours qui avaient une prévision comptent.
 */
export function measureAccuracy(
  snapshots: { date: string; product_id: string; quantity: number; revenue: number }[],
  actuals: SalesRow[]
): { accuracy: number | null; days: AccuracyDay[] } {
  const forecastDays = new Set(snapshots.map((s) => s.date));
  const key = (d: string, p: string) => `${d}|${p}`;
  const forecast = new Map(snapshots.map((s) => [key(s.date, s.product_id), s]));
  const actual = new Map(actuals.filter((a) => forecastDays.has(a.day)).map((a) => [key(a.day, a.product_id), a]));

  let errors = 0;
  let volume = 0;
  for (const k of new Set([...forecast.keys(), ...actual.keys()])) {
    const f = forecast.get(k)?.quantity ?? 0;
    const a = actual.get(k)?.quantity ?? 0;
    errors += Math.abs(a - f);
    volume += a;
  }

  const days = [...forecastDays].sort().map((date) => ({
    date,
    forecastRevenue: snapshots.filter((s) => s.date === date).reduce((s, x) => s + x.revenue, 0),
    actualRevenue: actuals.filter((a) => a.day === date).reduce((s, x) => s + x.revenue, 0),
  }));
  return { accuracy: volume > 0 ? Math.max(0, Math.round((1 - errors / volume) * 1000) / 10) : null, days };
}
