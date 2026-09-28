'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createManualEntry } from '@/app/actions/accounting';
import type { AccountLabel } from '@/lib/accounting/chart';
import { useT } from '@/lib/i18n/client';

type Line = { key: number; account: string; label: string; debit: string; credit: string };

const MANUAL_JOURNALS = ['OD', 'AC', 'TR', 'AN'] as const;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let nextKey = 3;
const emptyLine = (key: number): Line => ({ key, account: '', label: '', debit: '', credit: '' });

/** Saisie d'une écriture manuelle équilibrée. */
export function EntryForm({ chart }: { chart: AccountLabel[] }) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [journal, setJournal] = useState<(typeof MANUAL_JOURNALS)[number]>('OD');
  const [date, setDate] = useState(today());
  const [label, setLabel] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(1), emptyLine(2)]);

  const labels = new Map(chart.map((a) => [a.number, a.label]));
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = difference === 0 && totalDebit > 0;

  function update(key: number, patch: Partial<Line>) {
    setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function submit() {
    startTransition(async () => {
      const result = await createManualEntry({
        journal,
        date,
        label,
        reference,
        lines: lines.map((l) => ({
          account: l.account.trim(),
          label: l.label,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.newEntry.created'));
      router.push('/accounting/journal');
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <datalist id="chart-accounts">
        {chart.map((a) => (
          <option key={a.number} value={a.number}>
            {a.number} — {a.label}
          </option>
        ))}
      </datalist>

      <div className="grid gap-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 md:grid-cols-4">
        <label className="space-y-1 text-sm text-slate-300">
          {t('accounting.newEntry.journal')}
          <select
            value={journal}
            onChange={(e) => setJournal(e.target.value as (typeof MANUAL_JOURNALS)[number])}
            className="w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-100"
          >
            {MANUAL_JOURNALS.map((j) => (
              <option key={j} value={j}>
                {j} — {t(`accounting.journals.${j}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-slate-300">
          {t('accounting.newEntry.date')}
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="border-slate-600 bg-slate-900/50 text-slate-100 [color-scheme:dark]" />
        </label>
        <label className="space-y-1 text-sm text-slate-300 md:col-span-2">
          {t('accounting.newEntry.label')}
          <Input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder={t('accounting.newEntry.labelPlaceholder')} className="border-slate-600 bg-slate-900/50 text-slate-100" />
        </label>
        <label className="space-y-1 text-sm text-slate-300 md:col-span-2">
          {t('accounting.newEntry.reference')}
          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="border-slate-600 bg-slate-900/50 text-slate-100" />
        </label>
        <p className="self-end text-xs text-slate-500 md:col-span-2">{t('accounting.newEntry.salesAuto')}</p>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50">
        <div className="border-b border-slate-700/60 px-5 py-3 font-semibold text-slate-100">{t('accounting.newEntry.lines')}</div>
        <div className="space-y-3 p-5">
          {lines.map((line) => (
            <div key={line.key} className="grid gap-2 md:grid-cols-[10rem_1fr_9rem_9rem_2.5rem]">
              <div>
                <Input
                  list="chart-accounts"
                  value={line.account}
                  onChange={(e) => update(line.key, { account: e.target.value })}
                  placeholder={t('accounting.newEntry.accountPlaceholder')}
                  aria-label={t('accounting.common.account')}
                  className="border-slate-600 bg-slate-900/50 font-mono text-slate-100"
                />
                {line.account && (
                  <p className={labels.has(line.account.trim()) ? 'mt-1 truncate text-xs text-slate-500' : 'mt-1 text-xs text-rose-400'}>
                    {labels.get(line.account.trim()) ?? t('accounting.errors.unknownAccount', { account: line.account })}
                  </p>
                )}
              </div>
              <Input
                value={line.label}
                onChange={(e) => update(line.key, { label: e.target.value })}
                placeholder={t('accounting.newEntry.lineLabel')}
                aria-label={t('accounting.common.label')}
                className="border-slate-600 bg-slate-900/50 text-slate-100"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={line.debit}
                onChange={(e) => update(line.key, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                placeholder={t('accounting.common.debit')}
                aria-label={t('accounting.common.debit')}
                className="border-slate-600 bg-slate-900/50 text-right text-slate-100"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={line.credit}
                onChange={(e) => update(line.key, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                placeholder={t('accounting.common.credit')}
                aria-label={t('accounting.common.credit')}
                className="border-slate-600 bg-slate-900/50 text-right text-slate-100"
              />
              <Button
                type="button"
                variant="ghost"
                disabled={lines.length <= 2}
                onClick={() => setLines((list) => list.filter((l) => l.key !== line.key))}
                aria-label={t('accounting.newEntry.removeLine')}
                className="h-10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((list) => [...list, emptyLine(nextKey++)])}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('accounting.newEntry.addLine')}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/60 px-5 py-3 text-sm">
          <div className="flex gap-6 tabular-nums text-slate-300">
            <span>{t('accounting.common.debit')} : <strong className="text-slate-50">{format.number(totalDebit)}</strong></span>
            <span>{t('accounting.common.credit')} : <strong className="text-slate-50">{format.number(totalCredit)}</strong></span>
          </div>
          {balanced ? (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {t('accounting.newEntry.balanced')}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-300">
              <XCircle className="h-4 w-4" />
              {t('accounting.newEntry.unbalanced', { amount: format.number(Math.abs(difference)) })}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !balanced} className="bg-emerald-600 text-white hover:bg-emerald-700">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('accounting.newEntry.submit')}
        </Button>
      </div>
    </form>
  );
}
