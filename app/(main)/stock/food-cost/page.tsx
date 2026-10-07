import { requireModule } from '@/app/actions/auth';
import { getFoodCostReport } from '@/app/actions/recipes';
import { getStructureTaxSettings } from '@/lib/fiscal';
import { FoodCostReport } from '@/components/food-cost-report';

export default async function FoodCostPage() {
  const session = await requireModule('STOCK');
  const [rows, taxSettings] = await Promise.all([getFoodCostReport(), getStructureTaxSettings(session.structureId!)]);
  return <FoodCostReport rows={rows} taxSettings={taxSettings} />;
}
