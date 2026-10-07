import { redirect } from 'next/navigation';
import { requireModule } from '@/app/actions/auth';
import { getDirectReceiptData } from '@/app/actions/purchasing';
import { ReceiptForm } from '@/components/purchasing/receipt-form';

export default async function DirectReceiptPage() {
  const session = await requireModule('ACHATS');
  const data = await getDirectReceiptData();
  if (!data) redirect('/purchasing/receipts');
  return <ReceiptForm suppliers={data.suppliers} catalogs={data.catalogs} hasAccounting={Boolean(session.modules?.includes('COMPTABILITE'))} />;
}
