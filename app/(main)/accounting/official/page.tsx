import { redirect } from 'next/navigation';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { getAccountingData } from '@/app/actions/accounting';
import { getFiscalYears } from '@/app/actions/closing';
import { OfficialExport, type ExportSheet } from '@/components/accounting/official-export';
import { PrintButton } from '@/components/planning/print-button';
import { accountingDate } from '@/lib/accounting/posting';
import { dayBefore, fixedAssetsNote, officialBalanceSheet, officialCashFlow, officialIncomeStatement } from '@/lib/accounting/syscohada';
import { getT } from '@/lib/i18n/server';
import type { TranslationKey } from '@/lib/i18n/translate';
import { getAdminSupabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftYear(date: string, years: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export default async function OfficialStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; period?: string; point?: string }>;
}) {
  const params = await searchParams;
  // Sélecteur d'exercice : « début_fin »
  if (params.period && /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(params.period)) [params.from, params.to] = params.period.split('_');
  const [{ t, format }, years] = await Promise.all([getT(), getFiscalYears().catch(() => null)]);

  // Exercice : celui demandé, sinon l'exercice en cours (ou l'année civile)
  const year = accountingDate().slice(0, 4);
  const from = params.from && DATE_RE.test(params.from) ? params.from : years?.current.start ?? `${year}-01-01`;
  const to = params.to && DATE_RE.test(params.to) && params.to >= from ? params.to : years?.current.end ?? `${year}-12-31`;
  const previousTo = dayBefore(from);
  const previousFrom = shiftYear(from, -1);

  const data = await getAccountingData({ point: params.point, from, to });
  if (!data) redirect('/accounting');
  const { lines, scope } = data;

  const sheet = officialBalanceSheet(lines, to);
  const previousSheet = officialBalanceSheet(lines, previousTo);
  const income = officialIncomeStatement(lines, from, to);
  const previousIncome = officialIncomeStatement(lines, previousFrom, previousTo);
  const cash = officialCashFlow(lines, from, to);
  const previousCash = officialCashFlow(lines, previousFrom, previousTo);
  const note = fixedAssetsNote(lines, from, to);

  const { data: entity } = scope.structureId
    ? await getAdminSupabase().from('structures').select('name, niu, rccm, address, city').eq('id', scope.structureId).maybeSingle()
    : { data: null };

  const label = (ref: string) => t(`accounting.official.refs.${ref}` as TranslationKey);
  const prev = <T extends { ref: string }>(rows: T[], ref: string) => rows.find((r) => r.ref === ref);
  const totalAssets = prev(sheet.assets, 'BZ')?.net ?? 0;
  const totalLiabilities = prev(sheet.liabilities, 'DZ')?.amount ?? 0;
  const imbalance = totalAssets - totalLiabilities;
  const money = (n: number) => (n === 0 ? '—' : format.number(n, { maximumFractionDigits: 0 }));

  // Classeur Excel : mêmes références et montants (en nombres)
  const sheets: ExportSheet[] = [
    {
      name: t('accounting.official.sections.assets'),
      rows: [
        [t('accounting.official.columns.ref'), t('accounting.official.columns.label'), t('accounting.official.columns.gross'), t('accounting.official.columns.depreciation'), t('accounting.official.columns.net'), t('accounting.official.columns.previousNet')],
        ...sheet.assets.map((r) => [r.ref, label(r.ref), r.gross, r.depreciation, r.net, prev(previousSheet.assets, r.ref)?.net ?? 0]),
      ],
    },
    {
      name: t('accounting.official.sections.liabilities'),
      rows: [
        [t('accounting.official.columns.ref'), t('accounting.official.columns.label'), t('accounting.official.columns.amount'), t('accounting.official.columns.previous')],
        ...sheet.liabilities.map((r) => [r.ref, label(r.ref), r.amount, prev(previousSheet.liabilities, r.ref)?.amount ?? 0]),
      ],
    },
    {
      name: t('accounting.official.sections.income'),
      rows: [
        [t('accounting.official.columns.ref'), t('accounting.official.columns.label'), t('accounting.official.columns.amount'), t('accounting.official.columns.previous')],
        ...income.rows.map((r) => [r.ref, label(r.ref), r.amount, prev(previousIncome.rows, r.ref)?.amount ?? 0]),
      ],
    },
    {
      name: t('accounting.official.sections.cashflow'),
      rows: [
        [t('accounting.official.columns.ref'), t('accounting.official.columns.label'), t('accounting.official.columns.amount'), t('accounting.official.columns.previous')],
        ...cash.rows.map((r) => [r.ref, label(r.ref), r.amount, prev(previousCash.rows, r.ref)?.amount ?? 0]),
      ],
    },
    {
      name: t('accounting.official.sections.notes'),
      rows: [
        [t('accounting.official.columns.ref'), t('accounting.official.columns.label'), t('accounting.official.note.grossOpen'), t('accounting.official.note.increases'), t('accounting.official.note.decreases'), t('accounting.official.note.grossClose'), t('accounting.official.note.depOpen'), t('accounting.official.note.depAdded'), t('accounting.official.note.depRemoved'), t('accounting.official.note.depClose'), t('accounting.official.note.net')],
        ...note.map((n) => [n.ref, label(n.ref), n.grossOpen, n.increases, n.decreases, n.grossClose, n.depOpen, n.depAdded, n.depRemoved, n.depClose, n.grossClose - n.depClose]),
      ],
    },
  ];

  const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 print:text-black';
  const td = 'px-3 py-1.5 align-top';
  const num = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap';
  const rowClass = (total?: boolean) => cn('border-t border-slate-700/50 print:border-black/20', total && 'bg-slate-900/40 font-bold text-slate-50 print:bg-black/5 print:text-black');
  const card = 'overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50 print:break-inside-avoid print:border-black print:bg-white';

  return (
    <div className="space-y-6 text-sm text-slate-200 print:text-black">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50 print:text-black">{t('accounting.official.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-400 print:hidden">{t('accounting.official.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <form className="flex items-end gap-2">
            {params.point && <input type="hidden" name="point" value={params.point} />}
            <label className="text-sm text-slate-300">
              {t('accounting.official.period')}
              <select
                name="period"
                defaultValue={`${from}_${to}`}
                className="ml-2 h-9 rounded-md border border-slate-600 bg-slate-900/50 px-2 text-slate-100"
              >
                {[...(years ? [{ start: years.current.start, end: years.current.end }] : []), ...(years?.years.filter((y) => y.status === 'CLOSED').map((y) => ({ start: y.start_date, end: y.end_date })) ?? [])]
                  .concat(years ? [] : [0, 1, 2].map((i) => ({ start: `${Number(year) - i}-01-01`, end: `${Number(year) - i}-12-31` })))
                  .map((y) => (
                    <option key={y.start} value={`${y.start}_${y.end}`}>
                      {format.date(y.start)} → {format.date(y.end)}
                    </option>
                  ))}
              </select>
            </label>
            <button type="submit" className="h-9 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-200 hover:bg-slate-700">
              OK
            </button>
          </form>
          <OfficialExport sheets={sheets} fileName={`etats-syscohada-${from.slice(0, 4)}.xlsx`} label={t('accounting.official.export')} />
          <PrintButton label={t('accounting.official.print')} />
        </div>
      </div>

      {/* En-tête de l'entité (imprimé sur chaque état) */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 print:border-black print:bg-white">
        <p className="font-semibold text-slate-50 print:text-black">{entity?.name ?? t('accounting.official.identity')}</p>
        <p className="text-xs text-slate-400 print:text-black">
          {[entity?.niu && `${t('accounting.official.niu')} : ${entity.niu}`, entity?.rccm && `${t('accounting.official.rccm')} : ${entity.rccm}`, [entity?.address, entity?.city].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-1 text-sm text-slate-300 print:text-black">{t('accounting.official.exercise', { from: format.date(from), to: format.date(to) })}</p>
        <p className="text-xs text-slate-500 print:text-black">{t('accounting.official.previous', { from: format.date(previousFrom), to: format.date(previousTo) })}</p>
      </div>

      {/* Contrôles */}
      <ul className="space-y-1.5 print:hidden">
        <li className={cn('flex items-center gap-2 rounded-lg px-3 py-2', imbalance === 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300')}>
          {imbalance === 0 ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <CircleAlert className="h-4 w-4" aria-hidden />}
          {imbalance === 0 ? t('accounting.official.checks.balanced') : t('accounting.official.checks.unbalanced', { amount: format.money(imbalance) })}
        </li>
        <li className={cn('flex items-center gap-2 rounded-lg px-3 py-2', cash.gap === 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300')}>
          {cash.gap === 0 ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <CircleAlert className="h-4 w-4" aria-hidden />}
          {cash.gap === 0 ? t('accounting.official.checks.cashOk') : t('accounting.official.checks.cashGap', { amount: format.money(cash.gap) })}
        </li>
        {income.unmapped.length > 0 && (
          <li className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-300">
            <CircleAlert className="h-4 w-4" aria-hidden /> {t('accounting.official.checks.unmapped', { accounts: income.unmapped.join(', ') })}
          </li>
        )}
        <li className="flex items-start gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t('accounting.official.dsfHint')}
        </li>
      </ul>

      {/* Bilan */}
      <h3 className="text-lg font-semibold text-slate-50 print:text-black">{t('accounting.official.sections.balance')}</h3>
      <section className={card}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>{t('accounting.official.columns.ref')}</th>
              <th className={th}>{t('accounting.official.sections.assets')}</th>
              <th className={cn(th, 'text-right')}>{t('accounting.official.columns.gross')}</th>
              <th className={cn(th, 'text-right')}>{t('accounting.official.columns.depreciation')}</th>
              <th className={cn(th, 'text-right')}>{t('accounting.official.columns.net')}</th>
              <th className={cn(th, 'text-right')}>{t('accounting.official.columns.previousNet')}</th>
            </tr>
          </thead>
          <tbody>
            {sheet.assets.map((r) => (
              <tr key={r.ref} className={rowClass(r.total)}>
                <td className={cn(td, 'font-mono text-xs text-slate-400')}>{r.ref}</td>
                <td className={td}>{label(r.ref)}</td>
                <td className={num}>{money(r.gross)}</td>
                <td className={num}>{money(r.depreciation)}</td>
                <td className={num}>{money(r.net)}</td>
                <td className={cn(num, 'text-slate-400 print:text-black')}>{money(prev(previousSheet.assets, r.ref)?.net ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={card}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>{t('accounting.official.columns.ref')}</th>
              <th className={th}>{t('accounting.official.sections.liabilities')}</th>
              <th className={cn(th, 'text-right')}>{t('accounting.official.columns.amount')}</th>
              <th className={cn(th, 'text-right')}>{t('accounting.official.columns.previous')}</th>
            </tr>
          </thead>
          <tbody>
            {sheet.liabilities.map((r) => (
              <tr key={r.ref} className={rowClass(r.total)}>
                <td className={cn(td, 'font-mono text-xs text-slate-400')}>{r.ref}</td>
                <td className={td}>{label(r.ref)}</td>
                <td className={num}>{money(r.amount)}</td>
                <td className={cn(num, 'text-slate-400 print:text-black')}>{money(prev(previousSheet.liabilities, r.ref)?.amount ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Compte de résultat et flux de trésorerie */}
      {[
        { key: 'income', rows: income.rows, previous: previousIncome.rows },
        { key: 'cashflow', rows: cash.rows, previous: previousCash.rows },
      ].map((block) => (
        <div key={block.key} className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-50 print:text-black">{t(`accounting.official.sections.${block.key}` as TranslationKey)}</h3>
          <section className={card}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>{t('accounting.official.columns.ref')}</th>
                  <th className={th}>{t('accounting.official.columns.label')}</th>
                  <th className={cn(th, 'text-right')}>{t('accounting.official.columns.amount')}</th>
                  <th className={cn(th, 'text-right')}>{t('accounting.official.columns.previous')}</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r) => (
                  <tr key={r.ref} className={rowClass(r.total)}>
                    <td className={cn(td, 'font-mono text-xs text-slate-400')}>{r.ref}</td>
                    <td className={td}>{label(r.ref)}</td>
                    <td className={cn(num, r.amount < 0 && 'text-red-300 print:text-black')}>{money(r.amount)}</td>
                    <td className={cn(num, 'text-slate-400 print:text-black')}>{money(prev(block.previous, r.ref)?.amount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ))}

      {/* Note : immobilisations */}
      <h3 className="text-lg font-semibold text-slate-50 print:text-black">{t('accounting.official.sections.notes')}</h3>
      <section className={card}>
        {note.length === 0 ? (
          <p className="p-4 text-slate-500">{t('accounting.official.note.empty')}</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('accounting.official.columns.ref')}</th>
                <th className={th}>{t('accounting.official.columns.label')}</th>
                {(['grossOpen', 'increases', 'decreases', 'grossClose', 'depOpen', 'depAdded', 'depRemoved', 'depClose', 'net'] as const).map((k) => (
                  <th key={k} className={cn(th, 'text-right')}>
                    {t(`accounting.official.note.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {note.map((n) => (
                <tr key={n.ref} className={rowClass()}>
                  <td className={cn(td, 'font-mono text-xs text-slate-400')}>{n.ref}</td>
                  <td className={td}>{label(n.ref)}</td>
                  {[n.grossOpen, n.increases, n.decreases, n.grossClose, n.depOpen, n.depAdded, n.depRemoved, n.depClose, n.grossClose - n.depClose].map((v, i) => (
                    <td key={i} className={num}>
                      {money(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
