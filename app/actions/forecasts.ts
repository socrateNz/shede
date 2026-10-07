'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { addDays, localToday } from '@/lib/forecast';
import { computeForecast, loadAccuracy, loadSales } from '@/lib/forecast-server';

// Prévisions de ventes (docs/phase19-forecasts.sql), module PREVISIONS.

type Result = { success: boolean; error: string };

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'];

async function requireForecasts() {
  const session = await getSession();
  if (!session?.structureId || !VIEW_ROLES.includes(session.role)) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.modules?.includes('PREVISIONS')) return null;
  return session as typeof session & { structureId: string };
}

const notInstalled = (error: any) =>
  ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error?.code) || /daily_product_sales|forecast_/.test(error?.message ?? '');

/** Tableau de bord des prévisions. null : migration phase 19 non exécutée. */
export async function getForecastDashboard() {
  const session = await requireForecasts();
  if (!session) return null;
  try {
    const [forecast, accuracy, todaySales] = await Promise.all([
      computeForecast(session.structureId),
      loadAccuracy(session.structureId),
      loadSales(session.structureId, localToday(), localToday()),
    ]);
    return {
      installed: true as const,
      ...forecast,
      accuracy,
      todayActual: {
        revenue: todaySales.reduce((s, r) => s + r.revenue, 0),
        byProduct: Object.fromEntries(todaySales.map((r) => [r.product_id, r.quantity])),
      },
    };
  } catch (error) {
    if (notInstalled(error)) return { installed: false as const };
    throw error;
  }
}

export async function saveForecastEvent(input: { date: string; label: string; impact: number }): Promise<Result> {
  const session = await requireForecasts();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const label = String(input.label ?? '').trim().slice(0, 120);
  const impact = Math.round(Number(input.impact));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < addDays(localToday(), -365)) {
    return { success: false, error: await te('forecasts.errors.dateInvalid') };
  }
  if (!label) return { success: false, error: await te('forecasts.errors.labelRequired') };
  if (!Number.isFinite(impact) || impact < -100 || impact > 500) return { success: false, error: await te('forecasts.errors.impactInvalid') };

  const { error } = await getAdminSupabase()
    .from('forecast_events')
    .upsert(
      { structure_id: session.structureId, event_date: input.date, label, impact_percent: impact, created_by: session.userId },
      { onConflict: 'structure_id,event_date' }
    );
  if (error) return { success: false, error: await te('errors.createFailed') };
  revalidatePath('/forecasts');
  return { success: true, error: '' };
}

export async function deleteForecastEvent(id: string): Promise<Result> {
  const session = await requireForecasts();
  if (!session) return { success: false, error: await te('errors.unauthorized') };
  const { error } = await getAdminSupabase().from('forecast_events').delete().eq('id', id).eq('structure_id', session.structureId);
  if (error) return { success: false, error: await te('errors.deleteFailed') };
  revalidatePath('/forecasts');
  return { success: true, error: '' };
}
