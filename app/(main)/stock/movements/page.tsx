import { requireModule } from '@/app/actions/auth';
import { getStockMovements } from '@/app/actions/stock';
import { History } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StockMovementsList } from '@/components/stock-movements-list';

export default async function StockMovementsPage() {
  await requireModule('STOCK');
  const movements = await getStockMovements();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-3">
            <History className="w-8 h-8 text-blue-500" />
            Historique des mouvements
          </h1>
          <p className="text-slate-400">Tracez chaque changement de stock effectué dans votre établissement.</p>
        </div>
        <Link href="/stock">
          <Button variant="outline">
            Retour à l'inventaire
          </Button>
        </Link>
      </div>

      <StockMovementsList movements={movements as any} />
    </div>
  );
}

