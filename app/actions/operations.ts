'use server';

import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { loadAccuracy } from '@/lib/forecast-server';
import { periodRange, type PeriodKey } from '@/lib/periods';

// Pilotage multi-sites (ORG_ADMIN) : coûts et stock de chaque point de
// l'organisation, comparés. Le chiffre d'affaires suit la définition de la vue
// propriétaire (commandes COMPLETED datées par paid_at), ici hors taxe et hors
// pourboire ; le coût matière vient des sorties de stock des ventes, faites au
// même moment (paiement).

const PAGE_SIZE = 1000;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Requête tolérante : une table absente (migration non exécutée) donne une liste vide. */
async function optional<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

export type PointOperations = {
  id: string;
  name: string;
  modules: string[];
  revenue: number;
  /** Coût des ventes valorisées (ingrédients et produits revendus) */
  foodCost: number;
  foodCostPercent: number | null;
  /** Part des sorties de vente qui ont un coût connu (fiches recettes, coûts d'achat) */
  costCoverage: number | null;
  losses: number;
  lossesPercent: number | null;
  inventoryGap: number;
  inventories: number;
  lastInventoryAt: string | null;
  purchases: number;
  stockValue: number;
  lowStock: number;
  openOrders: number;
  forecastAccuracy: number | null;
};

export type OperationsReport = {
  organizationName: string;
  period: PeriodKey;
  points: PointOperations[];
  totals: Omit<PointOperations, 'id' | 'name' | 'modules' | 'lastInventoryAt' | 'forecastAccuracy' | 'costCoverage'>;
};

export async function getOperationsReport(period: PeriodKey): Promise<OperationsReport | null> {
  const session = await getSession();
  if (!session || session.role !== 'ORG_ADMIN' || !session.organizationId) return null;
  const admin = getAdminSupabase();
  const { from, to } = periodRange(period);

  const [{ data: organization }, { data: structures }] = await Promise.all([
    admin.from('organizations').select('name').eq('id', session.organizationId).maybeSingle(),
    admin.from('structures').select('id, name, modules, is_active').eq('organization_id', session.organizationId).order('name'),
  ]);
  const points = (structures || []).filter((s) => s.is_active !== false);

  const reports = await Promise.all(
    points.map(async (point): Promise<PointOperations> => {
      const id = point.id as string;
      const modules = (point.modules as string[] | null) ?? [];

      const [orders, movements, inventories, lastInventory, receipts, stocks, openOrders] = await Promise.all([
        fetchAll<{ total: number; tax: number | null; tip_amount: number | null }>((a, b) =>
          admin
            .from('orders')
            .select('total, tax, tip_amount')
            .eq('structure_id', id)
            .eq('status', 'COMPLETED')
            .gte('paid_at', from)
            .lt('paid_at', to)
            .range(a, b)
        ),
        optional(() =>
          fetchAll<{ reason: string; quantity: number; unit_cost: number | null }>((a, b) =>
            admin
              .from('stock_movements')
              .select('reason, quantity, unit_cost')
              .eq('structure_id', id)
              .eq('type', 'OUT')
              .in('reason', ['sale', 'loss'])
              .gte('created_at', from)
              .lt('created_at', to)
              .range(a, b)
          )
        ),
        optional(async () => {
          const { data, error } = await admin
            .from('inventories')
            .select('variance_value')
            .eq('structure_id', id)
            .eq('status', 'VALIDATED')
            .gte('validated_at', from)
            .lt('validated_at', to);
          if (error) throw error;
          return data || [];
        }),
        optional(async () => {
          const { data, error } = await admin
            .from('inventories')
            .select('validated_at')
            .eq('structure_id', id)
            .eq('status', 'VALIDATED')
            .order('validated_at', { ascending: false })
            .limit(1);
          if (error) throw error;
          return data || [];
        }),
        optional(async () => {
          const { data, error } = await admin.from('goods_receipts').select('total_ht').eq('structure_id', id).gte('received_at', from).lt('received_at', to);
          if (error) throw error;
          return data || [];
        }),
        optional(async () => {
          // Valeur du stock : coût moyen des ingrédients, coût d'achat des produits revendus
          const { data, error } = await admin
            .from('stocks')
            .select('quantity, threshold, ingredient_id, product_id, ingredients(cost_per_unit, is_active), products(purchase_cost, is_deleted)')
            .eq('structure_id', id);
          if (error) throw error;
          return data || [];
        }),
        optional(async () => {
          const { data, error } = await admin.from('purchase_orders').select('id').eq('structure_id', id).in('status', ['SENT', 'PARTIAL']);
          if (error) throw error;
          return data || [];
        }),
      ]);

      const revenue = Math.round(orders.reduce((s, o) => s + Number(o.total) - (Number(o.tax) || 0) - (Number(o.tip_amount) || 0), 0));
      const sales = movements.filter((m) => m.reason === 'sale');
      const valued = sales.filter((m) => m.unit_cost !== null);
      const foodCost = Math.round(valued.reduce((s, m) => s + Number(m.quantity) * Number(m.unit_cost), 0));
      const losses = Math.round(
        movements.filter((m) => m.reason === 'loss' && m.unit_cost !== null).reduce((s, m) => s + Number(m.quantity) * Number(m.unit_cost), 0)
      );

      let stockValue = 0;
      let lowStock = 0;
      for (const s of stocks as any[]) {
        const active = s.ingredient_id ? s.ingredients?.is_active !== false : s.product_id ? !s.products?.is_deleted : true;
        if (!active) continue;
        const quantity = Number(s.quantity) || 0;
        const cost = s.ingredient_id ? Number(s.ingredients?.cost_per_unit) : s.products?.purchase_cost != null ? Number(s.products.purchase_cost) : 0;
        stockValue += Math.max(0, quantity) * (cost || 0);
        if (Number(s.threshold) > 0 && quantity <= Number(s.threshold)) lowStock++;
      }

      let forecastAccuracy: number | null = null;
      if (modules.includes('PREVISIONS')) {
        try {
          forecastAccuracy = (await loadAccuracy(id)).accuracy;
        } catch {
          forecastAccuracy = null;
        }
      }

      return {
        id,
        name: point.name as string,
        modules,
        revenue,
        foodCost,
        foodCostPercent: revenue > 0 && valued.length ? Math.round((foodCost / revenue) * 1000) / 10 : null,
        costCoverage: sales.length ? Math.round((valued.length / sales.length) * 100) : null,
        losses,
        lossesPercent: revenue > 0 ? Math.round((losses / revenue) * 1000) / 10 : null,
        inventoryGap: Math.round(inventories.reduce((s: number, i: any) => s + (Number(i.variance_value) || 0), 0)),
        inventories: inventories.length,
        lastInventoryAt: (lastInventory[0] as any)?.validated_at ?? null,
        purchases: Math.round(receipts.reduce((s: number, r: any) => s + (Number(r.total_ht) || 0), 0)),
        stockValue: Math.round(stockValue),
        lowStock,
        openOrders: openOrders.length,
        forecastAccuracy,
      };
    })
  );

  const sum = (key: keyof PointOperations) => reports.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const revenue = sum('revenue');
  const foodCost = sum('foodCost');
  const losses = sum('losses');
  return {
    organizationName: (organization?.name as string) ?? '',
    period,
    points: reports,
    totals: {
      revenue,
      foodCost,
      foodCostPercent: revenue > 0 && foodCost > 0 ? Math.round((foodCost / revenue) * 1000) / 10 : null,
      losses,
      lossesPercent: revenue > 0 ? Math.round((losses / revenue) * 1000) / 10 : null,
      inventoryGap: sum('inventoryGap'),
      inventories: sum('inventories'),
      purchases: sum('purchases'),
      stockValue: sum('stockValue'),
      lowStock: sum('lowStock'),
      openOrders: sum('openOrders'),
    },
  };
}
