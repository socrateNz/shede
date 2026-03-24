import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { requireAuth } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { NewOrderForm } from '@/components/new-order-form';

export default async function NewOrderPage() {
  const session = await requireAuth();
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('products')
    .select('id, name, price')
    .eq('structure_id', session.structureId)
    .eq('is_available', true)
    .eq('is_deleted', false)
    .order('name', { ascending: true });

  return (
    <div className="p-8">
      <Link href="/orders" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      <NewOrderForm
        products={(data || []).map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price),
        }))}
      />
    </div>
  );
}
