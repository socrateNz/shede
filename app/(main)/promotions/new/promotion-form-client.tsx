'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tag, ArrowLeft, Save, Percent, Banknote, ShoppingBag, Calendar, Gift, KeySquare, Layers } from 'lucide-react';
import Link from 'next/link';
import { createPromotion, updatePromotion } from '@/app/actions/promotions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
}

export function PromotionFormClient({ 
  products, 
  initialData,
  onSuccess 
}: { 
  products: Product[], 
  initialData?: any,
  onSuccess?: () => void
}) {
  const [promoMode, setPromoMode] = useState<'STANDARD' | 'CODE' | 'BUY_X_GET_Y'>(initialData?.promo_mode || 'STANDARD');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.append('promo_mode', promoMode);
    
    if (promoMode === 'BUY_X_GET_Y') {
      formData.set('scope', 'PRODUCT');
    }

    try {
      let result;
      if (initialData?.id) {
        result = await updatePromotion(initialData.id, formData);
      } else {
        result = await createPromotion(formData);
      }

      if (result.success) {
        toast.success(initialData?.id ? "Promotion mise à jour !" : "Promotion créée avec succès !");
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/promotions');
        }
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de l'opération");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/promotions" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour aux promotions
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          {initialData ? 'Modifier la Promotion' : 'Nouvelle Promotion'}
        </h1>
        <p className="text-slate-400 text-lg font-light">
          {initialData ? 'Mettez à jour les paramètres de votre offre.' : 'Choisissez un mode et configurez votre offre.'}
        </p>
      </div>

      {/* Selector for Promo Mode - Hidden on Edit */}
      {!initialData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            type="button"
            onClick={() => setPromoMode('STANDARD')}
            className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all ${
              promoMode === 'STANDARD' ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Tag className={`w-6 h-6 ${promoMode === 'STANDARD' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span className="font-semibold text-slate-100">Standard</span>
            <span className="text-xs text-slate-400">Réduction automatique (% ou fixe) appliquée au panier.</span>
          </button>

          <button
            type="button"
            onClick={() => setPromoMode('CODE')}
            className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all ${
              promoMode === 'CODE' ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <KeySquare className={`w-6 h-6 ${promoMode === 'CODE' ? 'text-purple-400' : 'text-slate-500'}`} />
            <span className="font-semibold text-slate-100">Code Promo</span>
            <span className="text-xs text-slate-400">Offre activée uniquement via un mot secret (ex: SOLDE20).</span>
          </button>

          <button
            type="button"
            onClick={() => setPromoMode('BUY_X_GET_Y')}
            className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all ${
              promoMode === 'BUY_X_GET_Y' ? 'bg-emerald-600/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Gift className={`w-6 h-6 ${promoMode === 'BUY_X_GET_Y' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="font-semibold text-slate-100">Produit Offert</span>
            <span className="text-xs text-slate-400">Achetez-en Y, Obtenez-en X gratuitement.</span>
          </button>
        </div>
      )}

      <form action={handleSubmit}>
        <div className="space-y-6">
          
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
            <div className={`h-1 bg-gradient-to-r ${promoMode === 'STANDARD' ? 'from-blue-600 to-indigo-600' : promoMode === 'CODE' ? 'from-purple-600 to-fuchsia-600' : 'from-emerald-600 to-teal-600'}`} />
            <CardHeader>
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <Tag className={`w-5 h-5 ${promoMode === 'STANDARD' ? 'text-blue-400' : promoMode === 'CODE' ? 'text-purple-400' : 'text-emerald-400'}`} />
                Détails de l'Offre
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Nom de la promotion (Interne)</Label>
                <Input id="name" name="name" 
                  defaultValue={initialData?.name}
                  placeholder="Ex: Été 2026" required className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600" />
              </div>

              {promoMode === 'CODE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code_name" className="text-slate-300">Entrez le code secret</Label>
                    <Input id="code_name" name="code_name" 
                      defaultValue={initialData?.code_name}
                      placeholder="Ex: BIENVENUE10" required className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usage_limit" className="text-slate-300">Limite d'utilisation (Optionnel)</Label>
                    <Input id="usage_limit" name="usage_limit" type="number" 
                      defaultValue={initialData?.usage_limit}
                      placeholder="Ex: 100" className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                </div>
              )}

              {/* Standard & Code Promo Values */}
              {(promoMode === 'STANDARD' || promoMode === 'CODE') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Type de réduction</Label>
                    <Select name="type" defaultValue={initialData?.type || "PERCENTAGE"}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Choisir le type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                        <SelectItem value="PERCENTAGE" className="flex items-center gap-2 focus:bg-blue-600">
                          <div className="flex items-center gap-2">
                            <Percent className="w-3 h-3" /> Pourcentage (%)
                          </div>
                        </SelectItem>
                        <SelectItem value="FIXED" className="flex items-center gap-2 focus:bg-blue-600">
                          <div className="flex items-center gap-2">
                            <Banknote className="w-3 h-3" /> Montant Fixe (FCFA)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="value" className="text-slate-300">Valeur à déduire</Label>
                    <Input id="value" name="value" type="number" step="0.01" 
                      defaultValue={initialData?.value}
                      placeholder="Ex: 10" required className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                </div>
              )}

              {/* BUY_X_GET_Y Values */}
              {promoMode === 'BUY_X_GET_Y' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="required_qty" className="text-slate-300">Acheter (Quantité requise, Ex: Y)</Label>
                      <Input id="required_qty" name="required_qty" type="number" min="1" 
                        defaultValue={initialData?.required_qty}
                        placeholder="Ex: 2" required className="bg-slate-800 border-slate-700 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="free_qty" className="text-slate-300">Offert (Quantité gratuite, Ex: X)</Label>
                      <Input id="free_qty" name="free_qty" type="number" min="1" 
                        defaultValue={initialData?.free_qty}
                        placeholder="Ex: 1" required className="bg-slate-800 border-slate-700 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-800 mt-4">
                    <div className="flex h-5 items-center">
                      <input
                        id="is_cumulative"
                        name="is_cumulative"
                        type="checkbox"
                        defaultChecked={initialData ? initialData.is_cumulative : true}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <Label htmlFor="is_cumulative" className="font-medium text-slate-200">
                        Applicable à l'infini (Cumulatif)
                      </Label>
                      <p className="text-xs text-slate-400">Si coché, acheter N*Y offrira N*X au client.</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                Restriction des Produits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Standard or Code allows Scope. Buy X GET Y forces Product. */}
                {(promoMode === 'STANDARD' || promoMode === 'CODE') ? (
                  <div className="space-y-2">
                    <Label className="text-slate-300">Portée (Scope)</Label>
                    <Select name="scope" defaultValue="ORDER">
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Choisir la portée" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                        <SelectItem value="ORDER" className="focus:bg-blue-600">Sur toute la commande</SelectItem>
                        <SelectItem value="PRODUCT" className="focus:bg-blue-600">Sur un produit spécifique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-500" /> Portée Forcée
                    </Label>
                    <div className="p-2.5 rounded-lg border border-emerald-900 bg-emerald-950/30 text-emerald-400 text-sm">
                      S'applique sur un produit spécifique obligatoirement.
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="product_id" className="text-slate-300">Sélection Ciblée {promoMode === 'BUY_X_GET_Y' ? '(Obligatoire)' : '(Optionnel)'}</Label>
                  <Select name="product_id" defaultValue={initialData?.product_id || "none"}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Sélectionner un produit" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200 max-h-[300px]">
                      {promoMode !== 'BUY_X_GET_Y' && <SelectItem value="none">Aucun (Toute la commande)</SelectItem>}
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(promoMode === 'STANDARD' || promoMode === 'CODE') && (
                <div className="space-y-2">
                  <Label htmlFor="min_order_amount" className="text-slate-300">Montant Minimum de Commande (FCFA)</Label>
                  <Input id="min_order_amount" name="min_order_amount" type="number" 
                    defaultValue={initialData?.min_order_amount || "0"}
                    className="bg-slate-800 border-slate-700 text-white" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Validité Temporelle
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date" className="text-slate-300">Date de début</Label>
                <Input id="start_date" name="start_date" type="datetime-local" required 
                  defaultValue={initialData?.start_date ? new Date(initialData.start_date).toISOString().slice(0, 16) : ''}
                  className="bg-slate-800 border-slate-700 text-white [color-scheme:dark]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date" className="text-slate-300">Date de fin</Label>
                <Input id="end_date" name="end_date" type="datetime-local" required 
                  defaultValue={initialData?.end_date ? new Date(initialData.end_date).toISOString().slice(0, 16) : ''}
                  className="bg-slate-800 border-slate-700 text-white [color-scheme:dark]" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 pt-4">
            <Link href="/promotions">
              <Button type="button" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl px-8">Annuler</Button>
            </Link>
            <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-12 rounded-xl h-12 shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <Save className="w-4 h-4 mr-2" /> {initialData ? 'Mettre à jour' : 'Enregistrer la Promotion'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
