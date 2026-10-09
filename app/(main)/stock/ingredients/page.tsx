import { requireModule } from '@/app/actions/auth';
import { listIngredients } from '@/app/actions/ingredients';
import { IngredientsManager } from '@/components/ingredients-manager';
import { parsePage } from '@/lib/pagination';

export default async function IngredientsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requireModule('STOCK');
  const params = await searchParams;
  // 20 ingrédients par page, recherche côté serveur ; statistiques en SQL.
  const result = await listIngredients({ page: parsePage(params.page), q: params.q });
  return <IngredientsManager result={result} />;
}
