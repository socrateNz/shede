import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FilePlus2, FileText } from 'lucide-react';
import { getAccountingScope } from '@/app/actions/accounting';
import { listSalesDocuments } from '@/app/actions/invoicing';
import { DocumentStateBadge } from '@/components/accounting/document-badges';
import { PageNav } from '@/components/page-nav';
import { UrlSearch, UrlSelect } from '@/components/url-filters';
import { accountingDate } from '@/lib/accounting/posting';
import { remainingDue } from '@/lib/invoicing';
import { getT } from '@/lib/i18n/server';
import { parsePage } from '@/lib/pagination';
import { cn } from '@/lib/utils';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; kind?: string; state?: string; q?: string }>;
}) {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const params = await searchParams;
  const { t, format } = await getT();
  const today = accountingDate();
  const data = await listSalesDocuments({ page: parsePage(params.page), kind: params.kind, state: params.state, q: params.q });
  const { stats } = data.meta;
  const filtered = Boolean(params.kind || params.state || params.q);

  const cards = [
    { label: t('accounting.invoices.stats.invoiced'), value: format.money(stats.invoiced), tone: 'text-slate-50' },
    { label: t('accounting.invoices.stats.collected'), value: format.money(stats.collected), tone: 'text-emerald-300' },
    { label: t('accounting.invoices.stats.outstanding'), value: format.money(stats.outstanding), tone: 'text-amber-300', href: '/accounting/invoices?state=unpaid' },
    {
      label: t('accounting.invoices.stats.overdue'),
      value: format.money(stats.overdue),
      sub: t('accounting.invoices.stats.overdueCount', { count: stats.overdueCount }),
      tone: stats.overdue > 0 ? 'text-red-300' : 'text-slate-50',
      href: '/accounting/invoices?state=overdue',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{t('accounting.invoices.title')}</h2>
          <p className="text-sm text-slate-400">{t('accounting.invoices.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/accounting/invoices/new?kind=QUOTE" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 text-sm font-medium text-slate-200 hover:bg-slate-700">
            <FileText className="h-4 w-4" aria-hidden /> {t('accounting.invoices.newQuote')}
          </Link>
          <Link href="/accounting/invoices/new?kind=INVOICE" className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
            <FilePlus2 className="h-4 w-4" aria-hidden /> {t('accounting.invoices.newInvoice')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const body = (
            <>
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className={cn('mt-2 text-xl font-bold tabular-nums sm:text-2xl', card.tone)}>{card.value}</p>
              {card.sub && <p className="mt-1 text-xs text-slate-500">{card.sub}</p>}
            </>
          );
          return card.href ? (
            <Link key={card.label} href={card.href} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-colors hover:border-slate-500 sm:p-5">
              {body}
            </Link>
          ) : (
            <div key={card.label} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5">
              {body}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <UrlSearch placeholder={t('accounting.invoices.filters.search')} className="min-w-56 flex-1" />
        <UrlSelect
          param="kind"
          label={t('accounting.invoices.filters.allKinds')}
          options={[
            { value: '', label: t('accounting.invoices.filters.allKinds') },
            { value: 'INVOICE', label: t('accounting.invoices.kinds.INVOICE') },
            { value: 'QUOTE', label: t('accounting.invoices.kinds.QUOTE') },
            { value: 'CREDIT_NOTE', label: t('accounting.invoices.kinds.CREDIT_NOTE') },
          ]}
        />
        <UrlSelect
          param="state"
          label={t('accounting.invoices.filters.allStates')}
          options={[
            { value: '', label: t('accounting.invoices.filters.allStates') },
            { value: 'unpaid', label: t('accounting.invoices.filters.unpaid') },
            { value: 'overdue', label: t('accounting.invoices.filters.overdue') },
            { value: 'DRAFT', label: t('accounting.invoices.statuses.DRAFT') },
            { value: 'ISSUED', label: t('accounting.invoices.statuses.ISSUED') },
            { value: 'ACCEPTED', label: t('accounting.invoices.statuses.ACCEPTED') },
            { value: 'REFUSED', label: t('accounting.invoices.statuses.REFUSED') },
            { value: 'CONVERTED', label: t('accounting.invoices.statuses.CONVERTED') },
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('accounting.invoices.columns.number')}</th>
              <th className="px-4 py-3">{t('accounting.invoices.columns.date')}</th>
              <th className="px-4 py-3">{t('accounting.invoices.columns.customer')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.invoices.columns.total')}</th>
              <th className="px-4 py-3 text-right">{t('accounting.invoices.columns.due')}</th>
              <th className="px-4 py-3">{t('accounting.invoices.columns.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  {filtered ? t('accounting.invoices.noMatch') : t('accounting.invoices.empty')}
                </td>
              </tr>
            ) : (
              data.items.map((d) => {
                const due = d.kind === 'INVOICE' && d.status === 'ISSUED' ? remainingDue(d) : 0;
                return (
                  <tr key={d.id} className="text-slate-200 hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <Link href={`/accounting/invoices/${d.id}`} className="font-mono text-xs font-semibold text-emerald-300 hover:underline">
                        {d.number ?? t('accounting.invoices.draftNumber')}
                      </Link>
                      <p className="text-xs text-slate-500">{t(`accounting.invoices.kinds.${d.kind}`)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{format.date(d.issue_date)}</td>
                    <td className="px-4 py-3">
                      {d.customers?.name ?? '—'}
                      {d.subject && <p className="max-w-xs truncate text-xs text-slate-500">{d.subject}</p>}
                    </td>
                    <td className={cn('px-4 py-3 text-right tabular-nums', d.kind === 'CREDIT_NOTE' && 'text-red-300')}>
                      {d.kind === 'CREDIT_NOTE' ? '- ' : ''}
                      {format.money(d.total_ttc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{due > 0 ? format.money(due) : '—'}</td>
                    <td className="px-4 py-3">
                      <DocumentStateBadge doc={d} today={today} t={t} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <PageNav meta={data.meta} />
    </div>
  );
}
