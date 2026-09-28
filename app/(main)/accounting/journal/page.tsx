import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getJournalEntries } from '@/app/actions/accounting';
import { FilterBar, SetupNotice } from '@/components/accounting/filter-bar';
import { ReverseButton } from '@/components/accounting/reverse-button';
import { OwnerExportButton } from '@/components/owner/owner-export-button';
import { Button } from '@/components/ui/button';
import { accountLabel } from '@/lib/accounting/chart';
import { JOURNALS } from '@/lib/accounting/mapping';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; point?: string; journal?: string }>;
}) {
  const params = await searchParams;
  const data = await getJournalEntries(params);
  if (!data) redirect('/accounting/expenses');
  const { t, format } = await getT();
  const { scope, period, entries, chart, journal } = data;
  const pointName = new Map(scope.points.map((p) => [p.id, p.name]));

  const hrefFor = (next: string | null) => {
    const search = new URLSearchParams({ from: period.from, to: period.to });
    if (scope.pointId) search.set('point', scope.pointId);
    if (next) search.set('journal', next);
    return `/accounting/journal?${search.toString()}`;
  };

  const exportRows = entries.flatMap((e) =>
    e.lines.map((l) => ({
      [t('accounting.common.journal')]: e.journal,
      [t('accounting.common.number')]: e.number,
      [t('accounting.common.date')]: e.entry_date,
      [t('accounting.common.account')]: l.account,
      [t('accounting.common.label')]: l.label,
      [t('accounting.common.reference')]: e.reference ?? '',
      [t('accounting.common.debit')]: l.debit,
      [t('accounting.common.credit')]: l.credit,
      ...(scope.points.length ? { [t('org.pointSelect.label')]: pointName.get(e.structure_id) ?? '' } : {}),
    }))
  );

  return (
    <div className="space-y-6">
      <FilterBar from={period.from} to={period.to} points={scope.points} pointId={scope.pointId}>
        <OwnerExportButton
          sheets={{ [t('accounting.nav.journal')]: exportRows }}
          filename={t('accounting.journal.exportFile', { from: period.from, to: period.to })}
        />
        {scope.canPost && (
          <Link href="/accounting/journal/new">
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              {t('accounting.journal.newEntry')}
            </Button>
          </Link>
        )}
      </FilterBar>
      {!data.installed && <SetupNotice title={t('accounting.setup.title')} text={t('accounting.setup.text')} />}

      <div className="flex flex-wrap items-center gap-2">
        {[null, ...JOURNALS].map((j) => (
          <Link
            key={j ?? 'all'}
            href={hrefFor(j)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm',
              journal === j ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'
            )}
          >
            {j ? `${j} — ${t(`accounting.journals.${j}`)}` : t('accounting.filters.allJournals')}
          </Link>
        ))}
        <span className="ml-auto text-sm text-slate-400">{t('accounting.journal.count', { count: entries.length })}</span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-12 text-center text-slate-500">
          {t('accounting.common.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const total = e.lines.reduce((s, l) => s + l.debit, 0);
            return (
              <details key={e.id} className="group rounded-xl border border-slate-700/50 bg-slate-800/50">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3">
                  <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-emerald-300">{e.number}</span>
                  <span className="text-sm text-slate-400">{format.date(e.entry_date)}</span>
                  <span className="flex-1 text-sm font-medium text-slate-100">{e.label}</span>
                  {e.source_type !== 'MANUAL' && e.source_type !== 'REVERSAL' && (
                    <span className="rounded-full border border-sky-500/30 px-2 py-0.5 text-xs text-sky-300">{t('accounting.journal.autoBadge')}</span>
                  )}
                  {e.source_type === 'REVERSAL' && (
                    <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300">{t('accounting.journal.reversalBadge')}</span>
                  )}
                  {e.reversed && (
                    <span className="rounded-full border border-rose-500/30 px-2 py-0.5 text-xs text-rose-300">{t('accounting.journal.reversedBadge')}</span>
                  )}
                  {scope.points.length > 0 && <span className="text-xs text-slate-500">{pointName.get(e.structure_id)}</span>}
                  <span className="font-semibold tabular-nums text-slate-100">{format.money(total)}</span>
                </summary>
                <div className="overflow-x-auto border-t border-slate-700/60">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2">{t('accounting.common.account')}</th>
                        <th className="px-4 py-2">{t('accounting.common.label')}</th>
                        <th className="px-4 py-2 text-right">{t('accounting.common.debit')}</th>
                        <th className="px-4 py-2 text-right">{t('accounting.common.credit')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {e.lines.map((l, i) => (
                        <tr key={i} className="text-slate-300">
                          <td className="whitespace-nowrap px-4 py-2">
                            <span className="font-mono text-slate-100">{l.account}</span>
                            <span className="ml-2 text-xs text-slate-500">{accountLabel(chart, l.account)}</span>
                          </td>
                          <td className="px-4 py-2">{l.label}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{l.debit ? format.number(l.debit) : ''}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{l.credit ? format.number(l.credit) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {scope.canPost && !e.reversed && e.source_type !== 'REVERSAL' && (
                    <div className="flex justify-end border-t border-slate-700/40 px-4 py-2">
                      <ReverseButton entryId={e.id} number={e.number} />
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
