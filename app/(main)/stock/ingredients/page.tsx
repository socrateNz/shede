import { requireModule } from '@/app/actions/auth';
import { listIngredients } from '@/app/actions/ingredients';
import { IngredientsManager } from '@/components/ingredients-manager';

export default async function IngredientsPage() {
  await requireModule('STOCK');
  const ingredients = await listIngredients();
  return <IngredientsManager initialIngredients={ingredients} />;
}
