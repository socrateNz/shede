import type fr from '../fr/operations';

/** Multi-site control: costs and stock of each outlet (organization administrator). */
const operations: typeof fr = {
  badge: 'Control',
  title: 'Outlet performance',
  subtitle: 'Food cost, losses, stock count gaps, purchases and stock of each outlet, side by side.',
  kpiRevenue: 'Revenue excl. VAT',
  kpiFoodCost: 'Food cost',
  kpiLosses: 'Recorded losses',
  kpiGap: 'Stock count gaps',
  kpiPurchases: 'Goods received',
  kpiStock: 'Stock value',
  ofRevenue: '{percent} % of revenue',
  target: 'Target ≤ {percent} %',
  alertsTitle: 'To watch',
  alertsEmpty: 'Nothing unusual over the period.',
  alerts: {
    foodCost: '{point}: food cost at {percent} % (target {target} %).',
    losses: '{point}: losses at {percent} % of revenue.',
    gap: '{point}: {amount} of missing stock not explained at stock counts.',
    noInventory: '{point}: no stock count for more than 30 days.',
    neverCounted: '{point}: no validated stock count.',
    lowStock: '{point}: {count} item(s) below the alert threshold.',
    coverage: '{point}: only {percent} % of sales have a known cost (missing recipes or purchase costs).',
    accuracy: '{point}: forecasts only {percent} % accurate.',
  },
  colPoint: 'Outlet',
  colRevenue: 'Revenue excl. VAT',
  colFoodCost: 'Food cost',
  colLosses: 'Losses',
  colGap: 'Count gap',
  colPurchases: 'Purchases',
  colStock: 'Stock',
  colLowStock: 'Below threshold',
  colAccuracy: 'Forecast acc.',
  colLastInventory: 'Last stock count',
  total: 'Organization',
  never: 'Never',
  coverageHint: '{percent} % of sales valued',
  openOrders: '{count} pending order(s)',
  empty: 'No active outlet.',
  method:
    'Revenue excl. VAT: sales paid over the period, excluding VAT and tips (as in the owner view). Food cost: cost of ingredients and resold products taken out of stock by those sales. Sales without a recipe or purchase cost are not valued: coverage shows it.',
};

export default operations;
