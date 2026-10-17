import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAccountingScope } from '@/app/actions/accounting';
import { getDocumentFormData, getSalesDocument } from '@/app/actions/invoicing';
import { listTreasuryChoices } from '@/app/actions/bank';
import { DocumentActions } from '@/components/accounting/document-actions';
import { DocumentStateBadge } from '@/components/accounting/document-badges';
import { DocumentForm } from '@/components/accounting/document-form';
import { getSession } from '@/lib/auth';
import { accountingDate } from '@/lib/accounting/posting';
import type { DocumentStructure } from '@/lib/documents';
import { computeDocumentTotals, natureOfAccount, remainingDue } from '@/lib/invoicing';
import { getT } from '@/lib/i18n/server';
import { getAdminSupabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default async function SalesDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const { id } = await params;
  const [doc, session, { t, format }, treasuryAccounts] = await Promise.all([getSalesDocument(id), getSession(), getT(), listTreasuryChoices()]);
  if (!doc) notFound();
  const today = accountingDate();

  // Établissement (en-tête du PDF)
  const { data: structure } = await getAdminSupabase()
    .from('structures')
    .select('name, address, city, country, phone, email, niu, rccm, currency, logo_url')
    .eq('id', session!.structureId!)
    .maybeSingle();

  const back = (
    <Link href="/accounting/invoices" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
      <ArrowLeft className="h-4 w-4" aria-hidden /> {t('accounting.invoices.detail.back')}
    </Link>
  );

  // Brouillon : formulaire modifiable + validation
  if (doc.status === 'DRAFT') {
    const form = await getDocumentFormData();
    return (
      <div className="space-y-4">
        {back}
        <DocumentActions document={doc} structure={structure as DocumentStructure | null} today={today} treasuryAccounts={treasuryAccounts} />
        <DocumentForm kind={doc.kind} customers={form?.customers ?? []} defaultTaxRate={form?.defaultTaxRate ?? 0} today={today} document={doc} />
      </div>
    );
  }

  const totals = computeDocumentTotals(
    doc.sales_document_lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      discountPercent: Number(l.discount_percent),
      taxRate: Number(l.tax_rate),
      nature: natureOfAccount(l.account),
    }))
  );
  const due = remainingDue(doc);
  const c = doc.customers;

  return (
    <div className="space-y-4">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{t(`accounting.invoices.kinds.${doc.kind}`)}</p>
          <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-50">
            <span className="font-mono">{doc.number}</span>
            <DocumentStateBadge doc={doc} today={today} t={t} />
          </h2>
          {doc.source?.number && (
            <Link href={`/accounting/invoices/${doc.source.id}`} className="text-sm text-emerald-300 hover:underline">
              {t('accounting.invoices.detail.source', { number: doc.source.number })}
            </Link>
          )}
        </div>
        <DocumentActions document={doc} structure={structure as DocumentStructure | null} today={today} treasuryAccounts={treasuryAccounts} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('accounting.invoices.detail.billTo')}</p>
              <p className="mt-1 font-semibold text-slate-100">{c.name}</p>
              {[c.contact_name, c.address, c.city, c.phone, c.email, c.niu && `NIU : ${c.niu}`].filter(Boolean).map((line) => (
                <p key={String(line)} className="text-sm text-slate-400">
                  {line}
                </p>
              ))}
            </div>
            <dl className="space-y-1 text-sm sm:text-right">
              <div>
                <dt className="inline text-slate-500">{t('accounting.invoices.detail.issueDate')} : </dt>
                <dd className="inline text-slate-200">{format.date(doc.issue_date)}</dd>
              </div>
              {doc.due_date && (
                <div>
                  <dt className="inline text-slate-500">{t('accounting.invoices.detail.dueDate')} : </dt>
                  <dd className="inline text-slate-200">{format.date(doc.due_date)}</dd>
                </div>
              )}
              {doc.subject && (
                <div>
                  <dt className="inline text-slate-500">{t('accounting.invoices.detail.subject')} : </dt>
                  <dd className="inline text-slate-200">{doc.subject}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-3">{t('accounting.invoices.form.description')}</th>
                  <th className="py-2 pr-3 text-right">{t('accounting.invoices.form.quantity')}</th>
                  <th className="py-2 pr-3 text-right">{t('accounting.invoices.form.unitPrice')}</th>
                  <th className="py-2 pr-3 text-right">{t('accounting.invoices.form.taxRate')}</th>
                  <th className="py-2 text-right">{t('accounting.invoices.form.lineTotal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {doc.sales_document_lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3">
                      {l.description}
                      {Number(l.discount_percent) > 0 && (
                        <span className="ml-2 text-xs text-slate-500">
                          −{format.number(Number(l.discount_percent), { maximumFractionDigits: 2 })} %
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{format.number(Number(l.quantity), { maximumFractionDigits: 3 })}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{format.money(l.unit_price)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{format.number(Number(l.tax_rate), { maximumFractionDigits: 2 })} %</td>
                    <td className="py-2 text-right tabular-nums">{format.money(l.total_ht)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-300">
              <dt>{t('accounting.invoices.form.subtotal')}</dt>
              <dd className="tabular-nums">{format.money(doc.subtotal_ht)}</dd>
            </div>
            {totals.taxByRate
              .filter((r) => r.rate > 0)
              .map((r) => (
                <div key={r.rate} className="flex justify-between text-slate-400">
                  <dt>
                    {t('accounting.invoices.form.tax')} {format.number(r.rate, { maximumFractionDigits: 2 })} %
                  </dt>
                  <dd className="tabular-nums">{format.money(r.tax)}</dd>
                </div>
              ))}
            <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-bold text-slate-50">
              <dt>{t('accounting.invoices.form.total')}</dt>
              <dd className="tabular-nums">{format.money(doc.total_ttc)}</dd>
            </div>
          </dl>
          {doc.notes && <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-900/40 p-3 text-sm text-slate-400">{doc.notes}</p>}
        </div>

        <div className="space-y-4">
          {doc.kind === 'INVOICE' && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
              <p className="text-sm font-semibold text-slate-200">{t('accounting.invoices.detail.payments')}</p>
              {doc.sales_payments.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">{t('accounting.invoices.detail.noPayments')}</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-700/60 text-sm">
                  {doc.sales_payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 py-2 text-slate-300">
                      <span>
                        {format.date(p.paid_at)} · {t(`accounting.paymentMethods.${p.payment_method}` as 'accounting.paymentMethods.CASH')}
                        {p.reference && <span className="block text-xs text-slate-500">{p.reference}</span>}
                      </span>
                      <span className="tabular-nums text-emerald-300">{format.money(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <dl className="mt-3 space-y-1 border-t border-slate-700 pt-3 text-sm">
                <div className="flex justify-between text-slate-400">
                  <dt>{t('accounting.invoices.detail.paid')}</dt>
                  <dd className="tabular-nums">{format.money(doc.amount_paid)}</dd>
                </div>
                {Number(doc.amount_credited) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <dt>{t('accounting.invoices.detail.credited')}</dt>
                    <dd className="tabular-nums">{format.money(doc.amount_credited)}</dd>
                  </div>
                )}
                <div className={cn('flex justify-between font-bold', due > 0 ? 'text-amber-300' : 'text-emerald-300')}>
                  <dt>{t('accounting.invoices.detail.remaining')}</dt>
                  <dd className="tabular-nums">{format.money(due)}</dd>
                </div>
              </dl>
            </div>
          )}

          {doc.derived.length > 0 && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
              <p className="text-sm font-semibold text-slate-200">{t('accounting.invoices.detail.derived')}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {doc.derived.map((d) => (
                  <li key={d.id} className="flex justify-between gap-2">
                    <Link href={`/accounting/invoices/${d.id}`} className="text-emerald-300 hover:underline">
                      {t(`accounting.invoices.kinds.${d.kind}`)} {d.number ?? t('accounting.invoices.draftNumber')}
                    </Link>
                    <span className="tabular-nums text-slate-400">{format.money(d.total_ttc)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doc.kind !== 'QUOTE' && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 text-sm">
              <p className="font-semibold text-slate-200">{t('accounting.invoices.detail.accounting')}</p>
              <p className={cn('mt-1', doc.entry_id ? 'text-emerald-300' : 'text-amber-300')}>
                {doc.entry_id ? t('accounting.invoices.detail.posted') : t('accounting.invoices.detail.notPosted')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
