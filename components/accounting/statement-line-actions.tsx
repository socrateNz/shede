'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Link2, Link2Off, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  autoMatchStatement,
  createEntryFromStatementLine,
  getMatchSuggestions,
  matchStatementLine,
  setStatementLineIgnored,
  unmatchStatementLine,
  type StatementLine,
} from '@/app/actions/bank';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

type Party = { id: string; name: string };
type Suggestions = Awaited<ReturnType<typeof getMatchSuggestions>>;

const COUNTERPARTS = ['631', '674', '411', '401', '581', '758', '658'] as const;

/** Actions d'une ligne de relevé : rapprocher (propositions ou nouvelle écriture), défaire, ignorer. */
export function StatementLineActions({ line, customers, suppliers }: { line: StatementLine; customers: Party[]; suppliers: Party[] }) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions>({ singles: [], combination: null, pool: [] });
  const [selected, setSelected] = useState<string[]>([]);
  const moneyIn = line.amount > 0;
  const [counterpart, setCounterpart] = useState<string>(moneyIn ? '411' : '631');
  const [otherAccount, setOtherAccount] = useState('');
  const [partyId, setPartyId] = useState('');
  const [label, setLabel] = useState(line.label);

  const act = (fn: () => Promise<{ success: boolean; error?: string }>, message?: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.success) return void toast.error(result.error);
      if (message) toast.success(message);
      setOpen(false);
      router.refresh();
    });

  async function openDialog() {
    setOpen(true);
    setLoading(true);
    setSelected([]);
    try {
      setSuggestions(await getMatchSuggestions(line.id));
    } finally {
      setLoading(false);
    }
  }

  const account = counterpart === 'other' ? otherAccount.trim() : counterpart;
  const target = Math.abs(line.amount);
  const selectedTotal = suggestions.pool.filter((c) => selected.includes(c.id)).reduce((sum, c) => sum + Math.abs(c.debit - c.credit), 0);
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const parties = account.startsWith('411') ? customers : account.startsWith('401') ? suppliers : null;

  if (line.status === 'MATCHED') {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => unmatchStatementLine(line.id))} className="h-8 text-slate-400 hover:bg-slate-700 hover:text-slate-200">
        {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2Off className="mr-1 h-4 w-4" />} {t('accounting.bank.unmatch')}
      </Button>
    );
  }
  if (line.status === 'IGNORED') {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setStatementLineIgnored(line.id, false))} className="h-8 text-slate-400 hover:bg-slate-700 hover:text-slate-200">
        <RotateCcw className="mr-1 h-4 w-4" /> {t('accounting.bank.restore')}
      </Button>
    );
  }

  const field = 'border-slate-600 bg-slate-900/50 text-slate-100';
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" onClick={openDialog} className="h-8 bg-emerald-600 text-white hover:bg-emerald-700">
        <Link2 className="mr-1 h-4 w-4" /> {t('accounting.bank.reconcile')}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setStatementLineIgnored(line.id, true))} className="h-8 text-slate-400 hover:bg-slate-700" aria-label={t('accounting.bank.ignore')} title={t('accounting.bank.ignore')}>
        <Ban className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('accounting.bank.matchTitle', { date: format.date(line.value_date) })}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-sm">
            <p className="text-slate-200">{line.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${moneyIn ? 'text-emerald-300' : 'text-red-300'}`}>{format.money(line.amount)}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-200">{t('accounting.bank.suggestions')}</p>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : suggestions.singles.length === 0 && !suggestions.combination ? (
              <p className="text-sm text-slate-500">{t('accounting.bank.noSuggestion')}</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.singles.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                    <div className="min-w-0 text-sm">
                      <p className="flex items-center gap-2 text-slate-200">
                        {i === 0 && <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />}
                        <span className="truncate">{s.label}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.number} · {format.date(s.entry_date)} · {s.gap === 0 ? t('accounting.bank.sameDay') : t('accounting.bank.gap', { days: Math.round(s.gap) })}
                      </p>
                    </div>
                    <Button size="sm" disabled={pending} onClick={() => act(() => matchStatementLine(line.id, s.id), t('accounting.bank.matched'))} className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700">
                      {t('accounting.bank.choose')}
                    </Button>
                  </li>
                ))}
                {suggestions.combination && (
                  <li className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <p className="flex items-center gap-2 font-semibold text-emerald-300">
                          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {t('accounting.bank.combinationTitle', { count: suggestions.combination.length, amount: format.money(target) })}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                          {suggestions.combination.map((c) => (
                            <li key={c.id}>
                              {format.date(c.entry_date)} · {c.label} · <span className="tabular-nums">{format.money(Math.abs(c.debit - c.credit))}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => act(() => matchStatementLine(line.id, suggestions.combination!.map((c) => c.id)), t('accounting.bank.matched'))}
                        className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        {t('accounting.bank.choose')}
                      </Button>
                    </div>
                  </li>
                )}
              </ul>
            )}
          </div>

          {!loading && suggestions.pool.length > 1 && (
            <details className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-200">{t('accounting.bank.groupTitle')}</summary>
              <p className="mt-1 text-xs text-slate-500">{t('accounting.bank.groupHint')}</p>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {suggestions.pool.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-300 hover:bg-slate-800">
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-emerald-500" />
                      <span className="w-20 shrink-0 text-xs text-slate-500">{format.date(c.entry_date)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      <span className="tabular-nums">{format.money(Math.abs(c.debit - c.credit))}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`text-sm tabular-nums ${Math.abs(selectedTotal - target) < 0.005 ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {t('accounting.bank.selectedTotal', { total: format.money(selectedTotal), amount: format.money(target) })}
                </span>
                <Button
                  size="sm"
                  disabled={pending || selected.length < 2 || Math.abs(selectedTotal - target) >= 0.005}
                  onClick={() => act(() => matchStatementLine(line.id, selected), t('accounting.bank.matched'))}
                  className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {t('accounting.bank.matchSelection', { count: selected.length })}
                </Button>
              </div>
            </details>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () =>
                  createEntryFromStatementLine({
                    statementLineId: line.id,
                    account,
                    label,
                    customerId: account.startsWith('411') ? partyId || null : null,
                    supplierId: account.startsWith('401') ? partyId || null : null,
                  }),
                t('accounting.bank.entryCreated')
              );
            }}
            className="space-y-3 border-t border-slate-700 pt-4"
          >
            <div>
              <p className="text-sm font-semibold text-slate-200">{t('accounting.bank.createTitle')}</p>
              <p className="text-xs text-slate-500">{t('accounting.bank.createHint')}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-slate-300">
                {t('accounting.bank.counterpart')}
                <select
                  value={counterpart}
                  onChange={(e) => {
                    setCounterpart(e.target.value);
                    setPartyId('');
                  }}
                  className="h-9 w-full rounded-md border border-slate-600 bg-slate-900/50 px-2 text-sm text-slate-100"
                >
                  {COUNTERPARTS.map((c) => (
                    <option key={c} value={c}>
                      {t(`accounting.bank.counterparts.${c}` as TranslationKey)}
                    </option>
                  ))}
                  <option value="other">{t('accounting.bank.counterparts.other')}</option>
                </select>
              </label>
              {counterpart === 'other' && (
                <label className="block space-y-1 text-sm text-slate-300">
                  {t('accounting.bank.otherAccount')}
                  <Input value={otherAccount} onChange={(e) => setOtherAccount(e.target.value)} pattern="[1-8][0-9]{1,11}" required className={`${field} font-mono`} />
                </label>
              )}
              {parties && (
                <label className="block space-y-1 text-sm text-slate-300">
                  {account.startsWith('411') ? t('accounting.bank.customer') : t('accounting.bank.supplier')}
                  <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="h-9 w-full rounded-md border border-slate-600 bg-slate-900/50 px-2 text-sm text-slate-100">
                    <option value="">—</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block space-y-1 text-sm text-slate-300 sm:col-span-2">
                {t('accounting.bank.entryLabel')}
                <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={250} className={field} />
              </label>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending || !account} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('accounting.bank.createEntry')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AutoMatchButton({ bankAccountId }: { bankAccountId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await autoMatchStatement(bankAccountId);
          if (!result.success) return void toast.error(result.error);
          const matched = result.data?.matched ?? 0;
          toast[matched ? 'success' : 'message'](matched ? t('accounting.bank.autoMatched', { count: matched }) : t('accounting.bank.autoMatchedNone'));
          router.refresh();
        })
      }
      className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
      {t('accounting.bank.autoMatch')}
    </Button>
  );
}
