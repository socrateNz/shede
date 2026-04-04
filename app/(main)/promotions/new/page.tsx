import { getProducts } from '@/app/actions/products';
import { createPromotion } from '@/app/actions/promotions';
import { requireRole } from '@/app/actions/auth';
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
import { Tag, ArrowLeft, Save, Percent, Banknote, LayoutDashboard, ShoppingBag, Calendar } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function NewPromotionPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const products = await getProducts();

  async function action(formData: FormData) {
    'use server';
    const result = await createPromotion(formData);
    if (result.success) {
      redirect('/promotions');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-3xl">
        <Link href="/promotions" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux promotions
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Nouvelle Promotion</h1>
          <p className="text-slate-400 text-lg font-light">Configurez une nouvelle offre de réduction pour vos clients.</p>
        </div>

        <form action={action}>
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
              <CardHeader>
                <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-blue-400" />
                  Informations Générales
                </CardTitle>
                <CardDescription className="text-slate-500">Nom et type de l'offre</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Nom de la promotion</Label>
                  <Input id="name" name="name" placeholder="Ex: Offre de Printemps" required className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Type de réduction</Label>
                    <Select name="type" defaultValue="PERCENTAGE">
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
                    <Label htmlFor="value" className="text-slate-300">Valeur</Label>
                    <Input id="value" name="value" type="number" step="0.01" placeholder="Ex: 10" required className="bg-slate-800 border-slate-700 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-purple-400" />
                  Application & Portée
                </CardTitle>
                <CardDescription className="text-slate-500">Où s'applique la réduction ?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div className="space-y-2">
                    <Label htmlFor="product_id" className="text-slate-300">Produit Spécifique (Optionnel)</Label>
                    <Select name="product_id">
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Sélectionner un produit" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_order_amount" className="text-slate-300">Montant Minimum de Commande (FCFA)</Label>
                  <Input id="min_order_amount" name="min_order_amount" type="number" defaultValue="0" className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  Validité Temporelle
                </CardTitle>
                <CardDescription className="text-slate-500">Définissez quand cette offre est active</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-slate-300">Date de début</Label>
                  <Input id="start_date" name="start_date" type="datetime-local" required className="bg-slate-800 border-slate-700 text-white [color-scheme:dark]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-slate-300">Date de fin</Label>
                  <Input id="end_date" name="end_date" type="datetime-local" required className="bg-slate-800 border-slate-700 text-white [color-scheme:dark]" />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4 pt-4">
              <Link href="/promotions">
                <Button type="button" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl px-8">Annuler</Button>
              </Link>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-12 rounded-xl h-12">
                <Save className="w-4 h-4 mr-2" /> Enregistrer la Promotion
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
