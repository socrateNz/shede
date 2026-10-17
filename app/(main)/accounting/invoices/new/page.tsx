import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAccountingScope } from '@/app/actions/accounting';
import { getDocumentFormData } from '@/app/actions/invoicing';
import { DocumentForm } from '@/components/accounting/document-form';
import { getT } from '@/lib/i18n/server';

export default async function NewSalesDocumentPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const { kind: rawKind } = await searchParams;
  const kind = rawKind === 'QUOTE' ? 'QUOTE' : 'INVOICE'; // un avoir se crée depuis la facture qu'il corrige
  const [data, { t }] = await Promise.all([getDocumentFormData(), getT()]);
  if (!data) redirect('/accounting');

  return (
    <div className="space-y-4">
      <Link href="/accounting/invoices" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('accounting.invoices.detail.back')}
      </Link>
      <DocumentForm kind={kind} customers={data.customers} defaultTaxRate={data.defaultTaxRate} today={data.today} />
    </div>
  );
}
