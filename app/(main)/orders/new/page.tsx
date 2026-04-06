import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { NewOrderForm } from '@/components/new-order-form';
import { getPromotions } from '@/app/actions/promotions';
import { getStructureActiveShift } from '@/app/actions/shifts';
import { AlertTriangle } from 'lucide-react';

export default async function NewOrderPage() {
  const session = await requireRole('ADMIN', 'CAISSE', 'SERVEUR');
  const activeShift = await getStructureActiveShift(session.structureId!);
  const admin = getAdminSupabase();

  const { data: productsData } = await admin
    .from('products')
    .select('id, name, price')
    .eq('structure_id', session.structureId)
    .eq('is_available', true)
    .eq('is_deleted', false)
    .order('name', { ascending: true });

  const products = (productsData || []).map((item) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price),
  }));

  // Charge pour chaque produit ses accompagnements configurés.
  const accompanimentsByProductId: Record<
    string,
    Array<{
      accompanimentId: string;
      name: string;
      unitPrice: number;
      quantityMultiplier: number;
    }>
  > = {};

  const productIds = products.map((p) => p.id);

  if (productIds.length > 0) {
    const { data: mappings } = await admin
      .from('product_accompaniments')
      .select('product_id, accompaniment_id, quantity')
      .in('product_id', productIds)
      .eq('structure_id', session.structureId);

    const mappingList = (mappings || []) as Array<{
      product_id: string;
      accompaniment_id: string;
      quantity: number | null;
    }>;

    const accompanimentIds = Array.from(new Set(mappingList.map((m) => m.accompaniment_id)));

    const { data: accRows } = await admin
      .from('accompaniments')
      .select('id, name, price, is_available, is_deleted')
      .in('id', accompanimentIds)
      .eq('structure_id', session.structureId);

    const accMap = new Map<
      string,
      { name: string; price: number; is_available: boolean; is_deleted: boolean }
    >(
      (accRows || [])
        .filter((a: any) => a.is_available && !a.is_deleted)
        .map((a: any) => [a.id as string, { name: a.name as string, price: Number(a.price), is_available: a.is_available, is_deleted: a.is_deleted }])
    );

    for (const m of mappingList) {
      const acc = accMap.get(m.accompaniment_id);
      if (!acc) continue;
      if (!accompanimentsByProductId[m.product_id]) accompanimentsByProductId[m.product_id] = [];
      accompanimentsByProductId[m.product_id].push({
        accompanimentId: m.accompaniment_id,
        name: acc.name,
        unitPrice: acc.price,
        quantityMultiplier: Number(m.quantity || 1),
      });
    }
  }

  const { data: rooms } = await admin
    .from('rooms')
    .select('id, number')
    .eq('structure_id', session.structureId)
    .order('number');

  const promotions = await getPromotions();
  const activePromotions = promotions.filter(p => p.is_active);

  return (
    <div className="p-8">
      <Link href="/orders" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      {!activeShift ? (
        <div className="max-w-2xl mx-auto mt-12 p-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center backdrop-blur-sm">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-amber-500 mb-4">Caisse fermée</h2>
          <p className="text-slate-300 mb-8 max-w-md mx-auto">
            Vous ne pouvez pas créer de nouvelle commande tant qu'aucune session de caisse n'est ouverte pour cet établissement.
          </p>
          {(session.role === 'ADMIN' || session.role === 'CAISSE') && (
            <Link href="/shifts">
              <button className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium">
                Ouvrir la caisse
              </button>
            </Link>
          )}
        </div>
      ) : (
        <NewOrderForm
          products={products}
          accompanimentsByProductId={accompanimentsByProductId}
          rooms={rooms || []}
          promotions={activePromotions}
        />
      )}
    </div>
  );
}
