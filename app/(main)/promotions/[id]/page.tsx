import { getPromotions, getPromoCodes, createPromoCode } from '@/app/actions/promotions';
import { requireRole } from '@/app/actions/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tag, ArrowLeft, Plus, Hash, Users, CheckCircle, Ticket, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PromoCodesPage({ params }: PageProps) {
  const { id: promotionId } = await params;
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  
  const promotions = await getPromotions();
  const promotion = promotions.find(p => p.id === promotionId);
  
  if (!promotion) {
    notFound();
  }

  const promoCodes = await getPromoCodes(promotionId);

  async function action(formData: FormData) {
    'use server';
    const result = await createPromoCode(formData);
    if (result.success) {
      revalidatePath(`/promotions/${promotionId}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/promotions" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux promotions
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-3">
               <Tag className="w-3 h-3 text-blue-400" />
               <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{promotion.name}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Codes Promo</h1>
            <p className="text-slate-400">Générez des codes uniques pour cette promotion.</p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4">
            <div className="text-center">
               <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Codes</p>
               <p className="text-xl font-bold text-white">{promoCodes.length}</p>
            </div>
            <div className="w-px h-8 bg-slate-800 mx-2" />
            <div className="text-center">
               <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Utilisations</p>
               <p className="text-xl font-bold text-green-400">{promoCodes.reduce((acc, c) => acc + (c.used_count || 0), 0)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Form */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-900 border-slate-800 sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-400" /> Ajouter un Code
                </CardTitle>
                <CardDescription className="text-slate-500">Créez un code de réduction</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={action} className="space-y-4">
                  <input type="hidden" name="promotion_id" value={promotionId} />
                  
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-slate-300">Code (Unique)</Label>
                    <Input id="code" name="code" placeholder="Ex: SUMMER24" required className="bg-slate-800 border-slate-700 text-white uppercase font-mono tracking-widest" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="usage_limit" className="text-slate-300">Limite d'utilisation globale</Label>
                    <Input id="usage_limit" name="usage_limit" type="number" placeholder="Laisser vide pour illimité" className="bg-slate-800 border-slate-700 text-white" />
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-xl">
                    Générer Code
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* List */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-800/50 border-b border-slate-700">
                <CardTitle className="text-lg text-slate-100">Liste des Codes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {promoCodes.length === 0 ? (
                  <div className="py-20 text-center text-slate-500 italic">
                    <Ticket className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    Aucun code généré pour cette promotion.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {promoCodes.map((code) => (
                      <div key={code.id} className="p-4 flex items-center justify-between group hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-mono font-bold text-sm border border-indigo-500/20">
                            {code.code[0]}
                          </div>
                          <div>
                            <p className="text-slate-100 font-mono font-bold tracking-widest">{code.code}</p>
                            <div className="flex items-center gap-3 mt-1">
                               <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                 <Users className="w-3 h-3" />
                                 {code.used_count} / {code.usage_limit || '∞'}
                               </span>
                               <span className="w-1 h-1 rounded-full bg-slate-700" />
                               <span className="text-[10px] text-slate-500 font-medium">
                                 Créé le {new Date(code.created_at).toLocaleDateString()}
                               </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                           {code.usage_limit && code.used_count >= code.usage_limit ? (
                             <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">EXPIRÉ</span>
                           ) : (
                             <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20">VALIDE</span>
                           )}
                           
                           {/* Add delete or active toggle if needed */}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-12 text-center">
            <p className="text-[11px] text-slate-600 font-medium uppercase tracking-[0.3em]">
                Shede SaaS - Code Generation Engine
            </p>
        </div>
      </div>
    </div>
  );
}
