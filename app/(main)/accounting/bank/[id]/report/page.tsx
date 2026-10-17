import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, TriangleAlert } from 'lucide-react';
import { getAccountingScope } from '@/app/actions/accounting';
import { getReconciliation } from '@/app/actions/bank';
import { PrintButton } from '@/components/planning/print-button';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

/** État de rapprochement à une date : soldes rectifiés côté banque et côté comptabilité, et le détail des écarts. */
export default async function BankReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ asOf?: string }> }) {
  const scope = await getAccountingScope();
  if (!scope?.canPost) redirect('/accounting');
  const [{ id }, { asOf }] = await Promise.all([params, searchParams]);
  const [data, { t, format }] = await Promise.all([getReconciliation(id, asOf), getT()]);
  if (!data) notFound();
  const { account, report } = data;

  const row = (label: string, value: number, strong = false) => (
    <div className={cn('flex justify-between gap-4 py-1.5', strong && 'border-t border-slate-600 pt-2 font-bold text-slate-50 print:border-black print:text-black')}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{format.money(value)}</dd>
    </div>
  );
  const balanced = Math.abs(report.difference) < 0.5;

  return (
    <div className="space-y-5 print:space-y-3 print:bg-white print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/accounting/bank/${account.id}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {account.name}
        </Link>
        <form className="flex items-end gap-2">
          <label className="text-sm text-slate-300">
            {t('accounting.bank.report.asOf')}{' '}
            <input type="date" name="asOf" defaultValue={report.asOf} className="ml-1 h-9 rounded-md border border-slate-600 bg-slate-900/50 px-2 text-slate-100" />
          </label>
          <button type="submit" className="h-9 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-200 hover:bg-slate-700">
            OK
          </button>
          <PrintButton label={t('accounting.bank.report.print')} />
        </form>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-slate-50 print:text-black">
          {t('accounting.bank.report.title')} — {account.name}
        </h2>
        <p className="text-sm text-slate-400 print:text-black">
          <span className="font-mono">{account.account}</span> · {t('accounting.bank.report.asOf')} {format.date(report.asOf)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2">
        <dl className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 text-sm text-slate-300 print:border-black print:bg-white print:text-black">
          <p className="mb-2 font-semibold text-slate-100 print:text-black">{t('accounting.bank.report.bankSide')}</p>
          {row(t('accounting.bank.report.bankBalance'), report.bankBalance)}
          {row(t('accounting.bank.report.depositsInTransit'), report.depositsInTransit)}
          {row(t('accounting.bank.report.outstandingPayments'), report.outstandingPayments)}
          {row(t('accounting.bank.report.adjustedBank'), report.adjustedBank, true)}
        </dl>
        <dl className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 text-sm text-slate-300 print:border-black print:bg-white print:text-black">
          <p className="mb-2 font-semibold text-slate-100 print:text-black">{t('accounting.bank.report.bookSide')}</p>
          {row(t('accounting.bank.report.bookBalance'), report.bookBalance)}
          {row(t('accounting.bank.report.unrecordedCredits'), report.unrecordedCredits)}
          {row(t('accounting.bank.report.unrecordedDebits'), report.unrecordedDebits)}
          {row(t('accounting.bank.report.adjustedBook'), report.adjustedBook, true)}
        </dl>
      </div>

      <p
        className={cn(
          'flex items-center gap-2 rounded-xl border p-4 text-sm font-semibold print:border-black print:text-black',
          balanced ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'
        )}
      >
        {balanced ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <TriangleAlert className="h-5 w-5" aria-hidden />}
        {balanced ? t('accounting.bank.report.balanced') : t('accounting.bank.report.difference', { amount: format.money(report.difference) })}
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-1">
        <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 print:border-black print:bg-white">
          <h3 className="mb-2 text-sm font-semibold text-slate-100 print:text-black">{t('accounting.bank.report.openBooks')}</h3>
          {data.openBooks.length === 0 ? (
            <p className="text-sm text-slate-500">{t('accounting.bank.report.none')}</p>
          ) : (
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-700/60 print:divide-black/20">
                {data.openBooks.map((b) => (
                  <tr key={b.id} className="text-slate-300 print:text-black">
                    <td className="py-1 pr-2 whitespace-nowrap">{format.date(b.entry_date)}</td>
                    <td className="py-1 pr-2">{b.label}</td>
                    <td className="py-1 text-right tabular-nums">{format.money(Number(b.debit) - Number(b.credit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 print:border-black print:bg-white">
          <h3 className="mb-2 text-sm font-semibold text-slate-100 print:text-black">{t('accounting.bank.report.openStatement')}</h3>
          {data.openStatement.length === 0 ? (
            <p className="text-sm text-slate-500">{t('accounting.bank.report.none')}</p>
          ) : (
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-700/60 print:divide-black/20">
                {data.openStatement.map((s) => (
                  <tr key={s.id} className="text-slate-300 print:text-black">
                    <td className="py-1 pr-2 whitespace-nowrap">{format.date(s.value_date)}</td>
                    <td className="py-1 pr-2">{s.label}</td>
                    <td className="py-1 text-right tabular-nums">{format.money(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
