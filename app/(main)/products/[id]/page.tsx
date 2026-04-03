import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';
import { ProductEditForm } from '@/components/product-edit-form';
import { ArrowLeft, Package, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireRole('ADMIN');
  const admin = getAdminSupabase();

  const productId = (await params).id;

  const { data: product, error: productError } = await admin
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('structure_id', session.structureId)
    .single();

  if (productError || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
              Produit non trouvé
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { data: options } = await admin
    .from('accompaniments')
    .select('id, name, price')
    .eq('structure_id', session.structureId)
    .eq('is_deleted', false)
    .eq('is_available', true)
    .order('name', { ascending: true });

  const { data: mappings } = await admin
    .from('product_accompaniments')
    .select('accompaniment_id, quantity')
    .eq('structure_id', session.structureId)
    .eq('product_id', productId);

  const { data: stockData } = await admin
    .from('stocks')
    .select('threshold')
    .eq('product_id', productId)
    .single();

  const initialAccompaniments: Record<string, { quantity: number; priceIncluded?: boolean }> = {};
  (mappings || []).forEach((m: any) => {
    const accId = m.accompaniment_id as string;
    initialAccompaniments[accId] = {
      quantity: Number(m.quantity || 1),
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl relative">
        {/* Back Button */}
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Retour aux produits</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
            <Package className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400 font-medium">Modification du produit</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            Modifier le produit
          </h1>
          <p className="text-slate-400">Mettez à jour les informations de votre produit</p>
        </div>

        {/* Info Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5" />
          <CardHeader className="border-b border-slate-700/50 pb-4">
            <CardTitle className="text-slate-50 flex items-center gap-2 text-lg">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Produit :</span>
                <span className="text-white font-medium">{product.name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Prix actuel :</span>
                <span className="text-white font-medium">{product.price.toLocaleString()} FCFA</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formulaire d'édition */}
        <ProductEditForm
          product={product as Product}
          accompanimentOptions={(options || []).map((p: any) => ({
            id: p.id as string,
            name: p.name as string,
            price: Number(p.price),
          }))}
          initialAccompaniments={initialAccompaniments}
          initialThreshold={stockData?.threshold ?? 5}
        />
      </div>
    </div>
  );
}