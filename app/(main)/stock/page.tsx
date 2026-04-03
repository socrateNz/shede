import { requireModule } from '@/app/actions/auth';
import { getStockList } from '@/app/actions/stock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Boxes, AlertTriangle, ArrowUpRight, ArrowDownLeft, History, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function StockPage() {
  await requireModule('STOCK');
  const stocks = await getStockList();

  const lowStockCount = stocks.filter(s => s.quantity <= s.threshold).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Gestion du Stock</h1>
          <p className="text-slate-400">Suivez et gérez l'inventaire de vos produits en temps réel.</p>
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
              Produits en stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{stocks.length}</div>
            <p className="text-xs text-slate-500 mt-1">Total référencé</p>
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
            <p className="text-xs text-slate-500 mt-1">Produits sous le seuil</p>
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

      <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80">
                <th className="p-4 text-sm font-semibold text-slate-300">Produit</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Catégorie</th>
                <th className="p-4 text-sm font-semibold text-slate-300 text-center">Quantité</th>
                <th className="p-4 text-sm font-semibold text-slate-300 text-center">Seuil</th>
                <th className="p-4 text-sm font-semibold text-slate-300 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {stocks.map((item) => (
                <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-200">{item.name}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-slate-400">{item.category || 'N/A'}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={cn(
                      "font-bold text-lg",
                      item.quantity <= item.threshold ? "text-amber-500" : "text-slate-50"
                    )}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="p-4 text-center text-slate-400 text-sm">
                    {item.threshold}
                  </td>
                  <td className="p-4 text-right">
                    {item.quantity <= 0 ? (
                      <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">
                        Rupture
                      </span>
                    ) : item.quantity <= item.threshold ? (
                      <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">
                        Bas
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {stocks.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Aucun produit trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
