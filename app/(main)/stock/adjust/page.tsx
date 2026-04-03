import { requireModule } from '@/app/actions/auth';
import { getStockList, addStockMovement } from '@/app/actions/stock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, Settings2, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { redirect } from 'next/navigation';

export default async function AdjustStockPage() {
  await requireModule('STOCK');
  const stocks = await getStockList();

  async function handleSubmit(formData: FormData) {
    'use server';
    const productId = String(formData.get('productId'));
    const type = String(formData.get('type')) as 'IN' | 'OUT' | 'ADJUSTMENT';
    const quantity = Number(formData.get('quantity'));
    const reason = String(formData.get('reason'));

    if (!productId || !quantity || !type) return;

    const result = await addStockMovement(productId, type, quantity, reason);
    if (result.success) {
      redirect('/stock');
    } else {
      redirect(`/stock/adjust?error=${encodeURIComponent(result.error || 'Erreur inconnue')}`);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-2xl relative">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/stock">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-50">Nouveau Mouvement</h1>
            <p className="text-slate-400">Enregistrez une entrée, sortie ou ajustement manuel.</p>
          </div>
        </div>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2 text-lg">
              <Settings2 className="w-5 h-5 text-blue-500" />
              Détails de l'opération
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {stocks.length === 0 ? (
              <div className="py-12 text-slate-400">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Aucun produit disponible</p>
                <p className="text-sm mt-2">Créez d'abord des produits dans le menu</p>
                <Link href="/products/new" className="mt-4 inline-block">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    Créer un produit
                  </Button>
                </Link>
              </div>
            ) : (
              <form action={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Produit à impacter
                  </label>
                  <select
                    name="productId"
                    className="w-full bg-slate-900/50 border border-slate-700 text-slate-50 rounded-lg p-2.5 focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  >
                    <option value="">Sélectionner un produit...</option>
                    {stocks.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Stock: {s.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Type de mouvement</label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="cursor-pointer">
                        <input type="radio" name="type" value="IN" className="peer hidden" required defaultChecked />
                        <div className="flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-700 bg-slate-900/30 text-slate-400 peer-checked:border-emerald-500/50 peer-checked:bg-emerald-500/10 peer-checked:text-emerald-500 transition-all">
                          <Plus className="w-5 h-5" />
                          <span className="text-xs font-semibold">ENTRÉE</span>
                        </div>
                      </label>
                      <label className="cursor-pointer">
                        <input type="radio" name="type" value="OUT" className="peer hidden" />
                        <div className="flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-700 bg-slate-900/30 text-slate-400 peer-checked:border-red-500/50 peer-checked:bg-red-500/10 peer-checked:text-red-500 transition-all">
                          <Minus className="w-5 h-5" />
                          <span className="text-xs font-semibold">SORTIE</span>
                        </div>
                      </label>
                      <label className="cursor-pointer">
                        <input type="radio" name="type" value="ADJUSTMENT" className="peer hidden" />
                        <div className="flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-700 bg-slate-900/30 text-slate-400 peer-checked:border-amber-500/50 peer-checked:bg-amber-500/10 peer-checked:text-amber-500 transition-all">
                          <Settings2 className="w-5 h-5" />
                          <span className="text-xs font-semibold">AJUSTEMENT</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Quantité</label>
                    <Input
                      type="number"
                      name="quantity"
                      step="0.001"
                      min="0"
                      className="bg-slate-900/50 border-slate-700 text-slate-50"
                      placeholder="Ex: 5"
                      required
                    />
                    <p className="text-[10px] text-slate-500">Pour ADJUSTMENT, saisissez le nouveau stock final.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Raison (Optionnel)</label>
                  <select
                    name="reason"
                    className="w-full bg-slate-900/50 border border-slate-700 text-slate-50 rounded-lg p-2.5 focus:border-blue-500 focus:ring-blue-500/20"
                  >
                    <option value="manual_adjustment">Ajustement manuel</option>
                    <option value="purchase">Nouvel achat / Réapprovisionnement</option>
                    <option value="loss">Perte / Vol / Casse</option>
                    <option value="return">Retour client</option>
                    <option value="inventory">Inventaire physique</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <Link href="/stock" className="flex-1">
                    <Button variant="outline" type="button" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                      Annuler
                    </Button>
                  </Link>
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                    Enregistrer le mouvement
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}