import { requireModule } from '@/app/actions/auth';
import { getStockList } from '@/app/actions/stock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Boxes, AlertTriangle, ArrowUpRight, History, Plus, Package, Coffee } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StockList } from '@/components/stock-list';

export default async function StockPage() {
  await requireModule('STOCK');
  const stocks = await getStockList();

  const productCount = stocks.filter(s => s.type === 'product').length;
  const accompCount = stocks.filter(s => s.type === 'accompaniment').length;

  const productsLow = stocks.filter(s => s.type === 'product' && s.quantity <= s.threshold).length;
  const accompLow = stocks.filter(s => s.type === 'accompaniment' && s.quantity <= s.threshold).length;
  const lowStockCount = productsLow + accompLow;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Gestion du Stock</h1>
          <p className="text-slate-400">Suivez et gérez l'inventaire de vos produits et accompagnements en temps réel.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/stock/movements">
            <Button variant="outline">
              <History className="w-4 h-4 mr-2" />
              Historique
            </Button>
          </Link>
          <Link href="/stock/adjust">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Mouvement
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium flex items-center gap-2">
              <Boxes className="w-4 h-4" />
              Articles en stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{stocks.length}</div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <div className="flex items-center gap-1 text-blue-400" title="Produits">
                <Package className="w-3 h-3" />
                <span>{productCount}</span>
              </div>
              <div className="flex items-center gap-1 text-purple-400" title="Accompagnements">
                <Coffee className="w-3 h-3" />
                <span>{accompCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-400 text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alertes de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{lowStockCount}</div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <div className="flex items-center gap-1 text-amber-500/80" title="Produits sous le seuil">
                <Package className="w-3 h-3" />
                <span>{productsLow}</span>
              </div>
              <div className="flex items-center gap-1 text-amber-500/80" title="Accompagnements sous le seuil">
                <Coffee className="w-3 h-3" />
                <span>{accompLow}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-emerald-400 text-sm font-medium flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" />
              Dernière entrée
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">---</div>
            <p className="text-xs text-slate-500 mt-1">Aujourd'hui</p>
          </CardContent>
        </Card>
      </div>

      <StockList stocks={stocks as any} />
    </div>
  );
}

