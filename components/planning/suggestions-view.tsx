'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Info, Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createOrderFromSuggestions } from '@/app/actions/planning';
import type { SupplierSuggestion } from '@/lib/replenishment';
import { useT } from '@/lib/i18n/client';

/** Commandes suggérées par fournisseur ; quantités ajustables avant de créer le bon de commande. */
export function SuggestionsView({ groups, canOrder, openDays }: { groups: SupplierSuggestion[]; canOrder: boolean; openDays: number }) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busySupplier, setBusySupplier] = useState<string | null>(null);
  const [packs, setPacks] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.flatMap((g) => g.lines.map((l) => [l.key, String(l.packs)])))
  );

  const unitShort = (unit: string | null) => (unit ? t(`ingredients.unitShort.${unit as 'kg' | 'l' | 'piece'}`) : t('purchasing.catalog.unitProduct'));
  const qty = (value: number, unit: string | null) => `${format.number(value, { maximumFractionDigits: 2 })} ${unitShort(unit)}`;
  const day = (date: string) => format.date(`${date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' });

  function createOrder(group: SupplierSuggestion) {
    if (!group.supplier) return;
    const supplier = group.supplier;
    setBusySupplier(supplier.id);
    startTransition(async () => {
      const result = await createOrderFromSuggestions({
        supplierId: supplier.id,
        deliveryDays: supplier.deliveryDays,
        leadTimeDays: supplier.leadTimeDays,
        lines: group.lines
          .filter((l) => l.offer)
          .map((l) => ({ supplierItemId: l.offer!.supplierItemId, packs: Math.max(0, Math.ceil(Number(packs[l.key]) || 0)) })),
      });
      setBusySupplier(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('planning.suggestions.orderCreated'));
      router.push(`/purchasing/orders/${result.data!.id}`);
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-6">
        <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('planning.suggestions.title')}</h1>
        <p className="max-w-3xl text-slate-400">{t('planning.suggestions.subtitle')}</p>
      </div>

      {openDays < 7 && <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{t('planning.suggestions.noHistory')}</p>}
      {!canOrder && <p className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-300">{t('planning.suggestions.needPurchasing')}</p>}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 py-16 text-center text-sm text-slate-400">{t('planning.suggestions.empty')}</div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const total = group.lines.reduce((s, l) => s + (l.offer ? Math.max(0, Math.ceil(Number(packs[l.key]) || 0)) * l.offer.unitPrice : 0), 0);
            const firstLine = group.lines[0];
            return (
              <section key={group.supplier?.id ?? 'none'} className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/50 bg-slate-800/60 px-4 py-3">
                  <div>
                    {group.supplier ? (
                      <Link href={`/purchasing/suppliers/${group.supplier.id}`} className="font-semibold text-white hover:text-cyan-300">{group.supplier.name}</Link>
                    ) : (
                      <p className="font-semibold text-amber-300">{t('planning.suggestions.noSupplier')}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      {group.supplier && firstLine?.nextDelivery
                        ? `${t('planning.suggestions.nextDelivery', { date: day(firstLine.nextDelivery) })} · ${t('planning.suggestions.coverUntil', { date: day(firstLine.coverUntil!) })}`
                        : t('planning.suggestions.noSupplierHint')}
                    </p>
                  </div>
                  {group.supplier && (
                    <div className="flex items-center gap-3">
                      {group.supplier.minOrderAmount > 0 && total > 0 && total < group.supplier.minOrderAmount && (
                        <span className="flex items-center gap-1 text-xs text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t('planning.suggestions.belowMinimum', { amount: format.money(group.supplier.minOrderAmount) })}
                        </span>
                      )}
                      <span className="text-sm text-slate-300">
                        {t('planning.suggestions.total')} : <strong className="tabular-nums text-white">{format.money(Math.round(total))}</strong>
                      </span>
                      {canOrder && (
                        <Button type="button" size="sm" onClick={() => createOrder(group)} disabled={pending || total <= 0} className="bg-cyan-600 text-white hover:bg-cyan-700">
                          {busySupplier === group.supplier.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-1.5 h-4 w-4" />}
                          {t('planning.suggestions.createOrder')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="text-left text-xs text-slate-400">
                      <tr>
                        <th className="px-4 py-2 font-medium">{t('planning.suggestions.colItem')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('planning.suggestions.colStock')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('planning.suggestions.colIncoming')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('planning.suggestions.colConsumption')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('planning.suggestions.colSafety')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('planning.suggestions.colNeed')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('planning.suggestions.colPacks')}</th>
                        <th className="px-4 py-2 text-right font-medium">{t('planning.suggestions.colTotal')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {group.lines.map((line) => {
                        const count = Math.max(0, Math.ceil(Number(packs[line.key]) || 0));
                        return (
                          <tr key={line.key} className={line.stockoutRisk ? 'bg-red-500/5' : ''}>
                            <td className="px-4 py-2">
                              <p className="font-medium text-slate-100">{line.name}</p>
                              {line.stockoutRisk && (
                                <p className="flex items-center gap-1 text-xs text-red-300">
                                  <AlertTriangle className="h-3 w-3" /> {t('planning.suggestions.stockout')}
                                </p>
                              )}
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums ${line.stock <= 0 ? 'text-red-400' : 'text-slate-300'}`}>{qty(line.stock, line.unit)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{line.incoming ? qty(line.incoming, line.unit) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-300">{qty(line.consumption, line.unit)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{line.safety ? qty(line.safety, line.unit) : '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-100">{qty(line.need, line.unit)}</td>
                            <td className="px-3 py-2 text-right">
                              {line.offer ? (
                                <div className="flex items-center justify-end gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={packs[line.key] ?? ''}
                                    onChange={(e) => setPacks({ ...packs, [line.key]: e.target.value })}
                                    className="h-8 w-16 border-slate-600 bg-slate-900/50 text-right text-slate-50"
                                    aria-label={`${t('planning.suggestions.colPacks')} — ${line.name}`}
                                  />
                                  <span className="w-28 truncate text-left text-xs text-slate-400" title={line.offer.packLabel}>× {line.offer.packLabel}</span>
                                </div>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-100">{line.offer && count ? format.money(count * line.offer.unitPrice) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-sm text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t('planning.suggestions.method')}</p>
      </div>
    </div>
  );
}
