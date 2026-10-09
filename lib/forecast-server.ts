import { getAdminSupabase } from '@/lib/supabase';
import { addDays, buildForecast, HISTORY_WEEKS, localToday, measureAccuracy, type ForecastEvent, type SalesRow } from '@/lib/forecast';
import { fetchAll } from '@/lib/pagination';

// Prévisions — accès base (module serveur, pas une Server Action) : partagé par
// l'écran Prévisions et la tâche planifiée /api/cron/forecasts.

export const FORECAST_HORIZON = 7;
export const ACCURACY_DAYS = 28;

export async function loadSales(structureId: string, from: string, to: string): Promise<SalesRow[]> {
  // Jours × produits : dépasse vite 1000 lignes, la limite de l'API ; lecture par tranches.
  const data = await fetchAll<any>((a, b) =>
    getAdminSupabase()
      .rpc('daily_product_sales', { p_structure_id: structureId, p_from: from, p_to: to })
      .order('day')
      .order('product_id')
      .range(a, b),
  );
  return data.map((r) => ({
    day: String(r.day),
    product_id: r.product_id,
    quantity: Number(r.quantity) || 0,
    revenue: Number(r.revenue) || 0,
  }));
}

/**
 * Calcule les prévisions des prochains jours d'un point et les conserve
 * (forecast_snapshots) pour mesurer ensuite leur fiabilité.
 */
export async function computeForecast(structureId: string, horizon = FORECAST_HORIZON) {
  const admin = getAdminSupabase();
  const today = localToday();
  const [history, { data: products }, { data: events }] = await Promise.all([
    loadSales(structureId, addDays(today, -HISTORY_WEEKS * 7), addDays(today, -1)),
    admin.from('products').select('id, name, price').eq('structure_id', structureId).eq('is_deleted', false).eq('is_available', true).order('name'),
    admin
      .from('forecast_events')
      .select('id, event_date, label, impact_percent')
      .eq('structure_id', structureId)
      .gte('event_date', addDays(today, -HISTORY_WEEKS * 7))
      .lte('event_date', addDays(today, horizon)),
  ]);

  const forecastEvents: (ForecastEvent & { id: string })[] = (events || []).map((e) => ({
    id: e.id as string,
    date: String(e.event_date),
    label: e.label as string,
    impact: Number(e.impact_percent) || 0,
  }));
  const productList = (products || []).map((p) => ({ id: p.id as string, name: p.name as string, price: Number(p.price) || 0 }));
  const result = buildForecast({ today, horizon, history, products: productList, events: forecastEvents });

  // Conservation : la dernière prévision faite avant chaque jour (aujourd'hui compris)
  const rows = result.days.flatMap((day) =>
    day.products
      .filter((p) => p.quantity > 0)
      .map((p) => ({
        structure_id: structureId,
        forecast_date: day.date,
        product_id: p.product_id,
        quantity: p.quantity,
        revenue: p.revenue,
        updated_at: new Date().toISOString(),
      }))
  );
  // Les produits qui ne sont plus prévus ne doivent pas garder une ancienne valeur
  await admin.from('forecast_snapshots').delete().eq('structure_id', structureId).gte('forecast_date', addDays(today, 1));
  if (rows.length) {
    // Aujourd'hui : on ne remplace que si rien n'a été conservé avant l'ouverture
    const todayRows = rows.filter((r) => r.forecast_date === today);
    const futureRows = rows.filter((r) => r.forecast_date > today);
    if (futureRows.length) await admin.from('forecast_snapshots').upsert(futureRows, { onConflict: 'structure_id,forecast_date,product_id' });
    if (todayRows.length) {
      await admin.from('forecast_snapshots').upsert(todayRows, { onConflict: 'structure_id,forecast_date,product_id', ignoreDuplicates: true });
    }
  }

  return { today, products: productList, events: forecastEvents, ...result };
}

/** Fiabilité des prévisions sur les derniers jours (prévu conservé / réalisé). */
export async function loadAccuracy(structureId: string) {
  const today = localToday();
  const from = addDays(today, -ACCURACY_DAYS);
  const to = addDays(today, -1);
  const [snapshots, actuals] = await Promise.all([
    fetchAll<any>((a, b) =>
      getAdminSupabase()
        .from('forecast_snapshots')
        .select('forecast_date, product_id, quantity, revenue')
        .eq('structure_id', structureId)
        .gte('forecast_date', from)
        .lte('forecast_date', to)
        .order('forecast_date')
        .order('product_id')
        .range(a, b),
    ),
    loadSales(structureId, from, to),
  ]);
  return measureAccuracy(
    (snapshots || []).map((s) => ({
      date: String(s.forecast_date),
      product_id: s.product_id as string,
      quantity: Number(s.quantity) || 0,
      revenue: Number(s.revenue) || 0,
    })),
    actuals
  );
}
