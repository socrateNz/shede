import type fr from '../fr/recipes';

/** Recipes and food cost of a dish. */
const recipes: typeof fr = {
  title: 'Recipe',
  subtitle: 'Ingredients used for one portion. Each sale takes them out of stock.',
  notInstalled: 'Run the docs/phase16-ingredients.sql migration to enable recipes.',
  noIngredients: 'No ingredients: create some first.',
  manageIngredients: 'Manage ingredients',
  empty: 'No ingredients in this recipe. Without a recipe, a sale takes the product itself out of stock.',
  addLine: 'Add an ingredient',
  ingredient: 'Ingredient',
  selectIngredient: 'Choose…',
  quantity: 'Quantity',
  unit: 'Unit',
  waste: 'Waste %',
  wasteHint: 'Preparation loss (peeling, trimming, cooking): the quantity taken out of stock is increased accordingly.',
  lineCost: 'Cost',
  remove: 'Remove',
  units: { kg: 'kg', g: 'g', l: 'l', ml: 'ml', piece: 'piece' },
  inactiveIngredient: '(inactive)',
  cost: 'Food cost',
  priceExcludingTax: 'Selling price excl. VAT',
  margin: 'Gross margin',
  percent: 'Food cost / price excl. VAT',
  target: 'Target: {percent} % maximum',
  save: 'Save recipe',
  saved: 'Recipe saved',
  saveProductFirst: 'Save the product first to add its recipe.',
  errors: {
    notFound: 'Product not found.',
    duplicate: 'An ingredient appears twice in the recipe.',
    quantityInvalid: 'Each line needs a positive quantity and waste below 90 %.',
    ingredientInvalid: 'An ingredient of the recipe no longer exists.',
    unitMismatch: 'Unit not compatible with the ingredient (kg ↔ g, l ↔ ml, piece).',
  },
};

export default recipes;
