import type fr from '../fr/foodCost';

/** Food cost report. */
const foodCost: typeof fr = {
  badge: 'Stock',
  title: 'Food cost',
  subtitle: 'Ingredient cost of each dish, gross margin and share of the selling price excl. VAT.',
  notInstalled: 'Run the docs/phase16-ingredients.sql migration to enable food cost.',
  statCoverage: 'Items with a recipe',
  statAverage: 'Average food cost',
  statAbove: 'Above target ({percent} %)',
  coverage: '{count} / {total}',
  filterAll: 'All',
  filterMissing: 'Without a recipe',
  filterAbove: 'Above target',
  colItem: 'Item',
  colType: 'Type',
  colPrice: 'Price incl. VAT',
  colPriceHT: 'Price excl. VAT',
  colCost: 'Food cost',
  colMargin: 'Gross margin',
  colPercent: 'Cost / price excl. VAT',
  colActions: 'Recipe',
  product: 'Product',
  accompaniment: 'Side dish',
  noRecipe: 'No recipe',
  editRecipe: 'Edit',
  createRecipe: 'Create',
  empty: 'No item matches.',
};

export default foodCost;
