'use server';

import { getSession } from '@/lib/auth';
import { te } from '@/lib/i18n/server';
import { loadProductionPlan, loadSuggestions } from '@/lib/planning-server';
import { savePurchaseOrder } from '@/app/actions/purchasing';
import { localToday } from '@/lib/forecast';
import { nextDeliveryDate } from '@/lib/purchasing';

// Commandes suggérées et plan de production (module PREVISIONS).

const MANAGE_ROLES = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'];
const PRODUCTION_ROLES = ['ADMIN', 'MANAGER', 'CUISINIER', 'BAR', 'SUPER_ADMIN'];

async function requirePlanning(roles: string[]) {
  const session = await getSession();
  if (!session?.structureId || !roles.includes(session.role)) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.modules?.includes('PREVISIONS')) return null;
  return session as typeof session & { structureId: string };
}

const notInstalled = (error: any) =>
  ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error?.code) || /daily_product_sales|hourly_sales_profile|forecast_/.test(error?.message ?? '');

export async function getSuggestions() {
  const session = await requirePlanning(MANAGE_ROLES);
  if (!session) return null;
  try {
    const data = await loadSuggestions(session.structureId);
    return { installed: true as const, ...data, canOrder: Boolean(session.modules?.includes('ACHATS')) || session.role === 'SUPER_ADMIN' };
  } catch (error) {
    if (notInstalled(error)) return { installed: false as const };
    throw error;
  }
}

/** Transforme les suggestions d'un fournisseur en bon de commande (brouillon, modifiable avant envoi). */
export async function createOrderFromSuggestions(input: {
  supplierId: string;
  deliveryDays: number[];
  leadTimeDays: number;
  lines: { supplierItemId: string; packs: number }[];
}) {
  const session = await requirePlanning(MANAGE_ROLES);
  if (!session) return { success: false as const, error: await te('errors.unauthorized') };
  return savePurchaseOrder({
    supplierId: input.supplierId,
    expectedDate: nextDeliveryDate(input.deliveryDays, input.leadTimeDays, new Date(`${localToday()}T12:00:00Z`)),
    lines: input.lines.filter((l) => l.packs > 0).map((l) => ({ supplierItemId: l.supplierItemId, quantity: l.packs })),
  });
}

export async function getProductionPlan(dayOffset: 0 | 1) {
  const session = await requirePlanning(PRODUCTION_ROLES);
  if (!session) return null;
  try {
    const plan = await loadProductionPlan(session.structureId, dayOffset);
    // Cuisine et bar ne voient que leur poste
    const station: 'CUISINE' | 'BAR' | null = session.role === 'CUISINIER' ? 'CUISINE' : session.role === 'BAR' ? 'BAR' : null;
    return { installed: true as const, ...plan, station, lines: station ? plan.lines.filter((l) => l.destination === station) : plan.lines };
  } catch (error) {
    if (notInstalled(error)) return { installed: false as const };
    throw error;
  }
}
