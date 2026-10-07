'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Coffee, Carrot, Loader2, Package, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cancelInventory, saveCount, validateInventory, type InventoryDetail, type InventoryLine } from '@/app/actions/inventory';
import { useT } from '@/lib/i18n/client';

type Filter = 'all' | 'uncounted' | 'counted';
type SaveState = 'saving' | 'saved' | 'error';

const TYPE_ICON = { ingredient: Carrot, product: Package, accompaniment: Coffee } as const;

/** Comptage d'un inventaire (mobile d'abord), puis validation ; consultation une fois clos. */
export function InventoryCount({ inventory }: { inventory: InventoryDetail }) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isOpen = inventory.status === 'DRAFT';
  const [blind, setBlind] = useState(isOpen);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>(isOpen ? 'uncounted' : 'all');
  const [counts, setCounts] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(inventory.lines.map((l) => [l.id, l.counted]))
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(inventory.lines.map((l) => [l.id, l.counted === null ? '' : String(l.counted)]))
  );
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});

  const unitShort = (unit: string | null) => (unit ? t(`ingredients.unitShort.${unit as 'kg' | 'l' | 'piece'}`) : '');
  const countedTotal = Object.values(counts).filter((c) => c !== null).length;
  const showExpected = !isOpen || !blind;

  const totalGapValue = inventory.lines.reduce((sum, line) => {
    const counted = counts[line.id];
    return counted === null || counted === undefined || line.unit_cost === null ? sum : sum + (counted - line.expected) * line.unit_cost;
  }, 0);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.lines.filter((line) => {
      if (q && !line.name.toLowerCase().includes(q)) return false;
      if (filter === 'uncounted') return counts[line.id] === null || counts[line.id] === undefined;
      if (filter === 'counted') return counts[line.id] !== null && counts[line.id] !== undefined;
      return true;
    });
  }, [inventory.lines, search, filter, counts]);

  async function commit(line: InventoryLine) {
    const raw = (drafts[line.id] ?? '').trim().replace(',', '.');
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setSaveState((s) => ({ ...s, [line.id]: 'error' }));
      return;
    }
    if (value === counts[line.id]) return;
    setSaveState((s) => ({ ...s, [line.id]: 'saving' }));
    const result = await saveCount(line.id, value);
    if (!result.success) {
      setSaveState((s) => ({ ...s, [line.id]: 'error' }));
      toast.error(result.error || t('stockControl.inventory.saveError'));
      return;
    }
    setCounts((c) => ({ ...c, [line.id]: value }));
    setSaveState((s) => ({ ...s, [line.id]: 'saved' }));
  }

  function validate() {
    const uncounted = inventory.lines.length - countedTotal;
    if (!confirm(t('stockControl.inventory.validateConfirm', { counted: countedTotal, uncounted }))) return;
    startTransition(async () => {
      const result = await validateInventory(inventory.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('stockControl.inventory.validated', { value: format.money(result.varianceValue ?? 0) }));
      router.refresh();
    });
  }

  function cancel() {
    if (!confirm(t('stockControl.inventory.cancelConfirm'))) return;
    startTransition(async () => {
      const result = await cancelInventory(inventory.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('stockControl.inventory.cancelled'));
      router.push('/stock/inventories');
    });
  }

  const filters: [Filter, string][] = [
    ['uncounted', t('stockControl.inventory.filterUncounted')],
    ['counted', t('stockControl.inventory.filterCounted')],
    ['all', t('stockControl.inventory.filterAll')],
  ];

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 pb-28 md:p-8 md:pb-28">
      <Link href="/stock/inventories" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-teal-300">
        <ArrowLeft className="h-4 w-4" /> {t('stockControl.inventory.back')}
      </Link>

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          {t('stockControl.inventory.countTitle', { date: format.date(inventory.created_at) })}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {t(`stockControl.inventory.status.${inventory.status}`)} ·{' '}
          {inventory.status === 'VALIDATED' && inventory.validated_at
            ? t('stockControl.inventory.validatedBy', { name: inventory.validated_by ?? '—', date: format.dateTime(inventory.validated_at) })
            : t('stockControl.inventory.startedBy', { name: inventory.started_by ?? '—' })}
        </p>
        {!isOpen && <p className="mt-2 text-sm text-amber-300">{t('stockControl.inventory.closed')}</p>}
      </div>

      {/* Avancement */}
      <div className="mb-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-300">{t('stockControl.inventory.progress', { counted: countedTotal, total: inventory.lines.length })}</span>
          {showExpected && (
            <span className={`font-semibold tabular-nums ${totalGapValue < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {t('stockControl.inventory.totalGap')} : {format.money(Math.round(isOpen ? totalGapValue : inventory.variance_value ?? totalGapValue))}
            </span>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${inventory.lines.length ? (countedTotal / inventory.lines.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {inventory.lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-600 p-6 text-center text-sm text-slate-400">{t('stockControl.inventory.noLines')}</p>
      ) : (
        <>
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('stockControl.inventory.search')} className="border-slate-600 bg-slate-900/50 pl-9 text-slate-50" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {filters.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      filter === key ? 'border-teal-500 bg-teal-500/20 text-teal-200' : 'border-slate-600 text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {isOpen && (
                <label className="flex items-center gap-2 text-xs text-slate-300" title={t('stockControl.inventory.blindHint')}>
                  <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} className="h-4 w-4" />
                  {t('stockControl.inventory.blind')}
                </label>
              )}
            </div>
          </div>

          <ul className="space-y-2">
            {visible.map((line) => {
              const Icon = TYPE_ICON[line.item_type];
              const counted = counts[line.id];
              const gap = counted === null || counted === undefined ? null : counted - line.expected;
              const state = saveState[line.id];
              return (
                <li key={line.id} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-100">{line.name}</p>
                      <p className="text-xs text-slate-500">
                        {t(`stock.itemType.${line.item_type}`)}
                        {showExpected && (
                          <>
                            {' '}· {t('stockControl.inventory.expected')} : {format.number(line.expected, { maximumFractionDigits: 3 })} {unitShort(line.unit)}
                          </>
                        )}
                      </p>
                    </div>
                    {isOpen ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={drafts[line.id] ?? ''}
                          placeholder={t('stockControl.inventory.countPlaceholder')}
                          onChange={(e) => {
                            setDrafts((d) => ({ ...d, [line.id]: e.target.value }));
                            setSaveState((s) => {
                              const { [line.id]: _done, ...rest } = s;
                              return rest;
                            });
                          }}
                          onBlur={() => commit(line)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="h-10 w-24 border-slate-600 bg-slate-900/60 text-right text-base text-slate-50"
                          aria-label={`${t('stockControl.inventory.counted')} — ${line.name}`}
                        />
                        <span className="w-8 text-xs text-slate-400">{unitShort(line.unit)}</span>
                        <span className="w-4">
                          {state === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                          {state === 'saved' && <Check className="h-4 w-4 text-emerald-400" />}
                          {state === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm tabular-nums text-slate-200">
                        {counted === null || counted === undefined
                          ? t('stockControl.inventory.notCounted')
                          : `${format.number(counted, { maximumFractionDigits: 3 })} ${unitShort(line.unit)}`}
                      </span>
                    )}
                  </div>
                  {showExpected && gap !== null && gap !== 0 && (
                    <p className={`mt-1.5 text-right text-xs tabular-nums ${gap < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {t('stockControl.inventory.gap')} : {gap > 0 ? '+' : ''}
                      {format.number(gap, { maximumFractionDigits: 3 })} {unitShort(line.unit)}
                      {line.unit_cost !== null && (
                        <>
                          {' '}· {format.money(Math.round(gap * line.unit_cost))}
                        </>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Barre d'actions fixe (inventaire en cours) */}
      {isOpen && inventory.can_validate && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-900/95 p-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancel} disabled={pending} className="text-red-300 hover:bg-red-500/10">
              <X className="mr-1.5 h-4 w-4" /> {t('stockControl.inventory.cancel')}
            </Button>
            <Button type="button" onClick={validate} disabled={pending || countedTotal === 0} className="bg-teal-600 text-white hover:bg-teal-700">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {t('stockControl.inventory.validate')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
