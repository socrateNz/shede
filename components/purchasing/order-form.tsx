'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { savePurchaseOrder, type CatalogItem, type PurchasingSupplier } from '@/app/actions/purchasing';
import { nextDeliveryDate } from '@/lib/purchasing';
import { useT } from '@/lib/i18n/client';

const INPUT = 'border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500';

/** Création ou modification (brouillon) d'un bon de commande, à partir du catalogue du fournisseur. */
export function PurchaseOrderForm({
  suppliers,
  catalogs,
  initial,
}: {
  suppliers: PurchasingSupplier[];
  catalogs: Record<string, CatalogItem[]>;
  initial?: {
    id?: string;
    number?: string;
    supplierId: string;
    expectedDate: string | null;
    note: string | null;
    quantities: Record<string, number>;
  };
}) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial?.quantities ?? {}).map(([k, v]) => [k, String(v)]))
  );

  const supplier = suppliers.find((s) => s.id === supplierId);
  const catalog = useMemo(() => catalogs[supplierId] ?? [], [catalogs, supplierId]);
  const suggestedDate = supplier ? nextDeliveryDate(supplier.delivery_days, supplier.lead_time_days) : null;
  const unitShort = (unit: string | null) => (unit ? t(`ingredients.unitShort.${unit as 'kg' | 'l' | 'piece'}`) : t('purchasing.catalog.unitProduct'));

  const total = catalog.reduce((sum, item) => sum + (Number(quantities[item.id]) || 0) * item.unit_price, 0);
  const belowMinimum = supplier && supplier.min_order_amount > 0 && total > 0 && total < supplier.min_order_amount;

  function chooseSupplier(id: string) {
    setSupplierId(id);
    setQuantities({});
    const next = suppliers.find((s) => s.id === id);
    if (next && !expectedDate) setExpectedDate(nextDeliveryDate(next.delivery_days, next.lead_time_days));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await savePurchaseOrder({
        id: initial?.id,
        supplierId,
        expectedDate: expectedDate || null,
        note,
        lines: catalog
          .map((item) => ({ supplierItemId: item.id, quantity: Number(String(quantities[item.id] ?? '').replace(',', '.')) || 0 }))
          .filter((l) => l.quantity > 0),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('purchasing.orders.saved'));
      router.push(`/purchasing/orders/${result.data!.id}`);
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 pb-28 md:p-8">
      <Link href={initial?.id ? `/purchasing/orders/${initial.id}` : '/purchasing/orders'} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300">
        <ArrowLeft className="h-4 w-4" /> {t('purchasing.orders.back')}
      </Link>
      <h1 className="mb-6 text-3xl font-bold text-white">
        {initial?.number ? t('purchasing.orders.editTitle', { number: initial.number }) : t('purchasing.orders.newTitle')}
      </h1>

      <form onSubmit={submit} className="space-y-6">
        <div className="grid gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="po-supplier" className="text-sm text-slate-300">{t('purchasing.orders.supplier')}</label>
            <select
              id="po-supplier"
              value={supplierId}
              onChange={(e) => chooseSupplier(e.target.value)}
              disabled={Boolean(initial?.id)}
              required
              className="h-10 w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-50 disabled:opacity-60"
            >
              <option value="">{t('purchasing.orders.selectSupplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="po-date" className="text-sm text-slate-300">{t('purchasing.orders.expectedDate')}</label>
            <Input id="po-date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={INPUT} />
            {suggestedDate && <p className="text-xs text-slate-500">{t('purchasing.orders.nextDelivery', { date: format.date(suggestedDate) })}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="po-note" className="text-sm text-slate-300">{t('purchasing.orders.note')}</label>
            <Input id="po-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t('purchasing.orders.notePlaceholder')} className={INPUT} />
          </div>
        </div>

        {supplier && (
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
            {catalog.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                {t('purchasing.orders.catalogEmpty')}{' '}
                <Link href={`/purchasing/suppliers/${supplier.id}`} className="text-cyan-300 hover:underline">{t('purchasing.orders.manageCatalog')}</Link>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50 text-left text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('purchasing.orders.colItem')}</th>
                      <th className="px-4 py-3 font-semibold">{t('purchasing.orders.colPack')}</th>
                      <th className="px-4 py-3 text-right font-semibold">{t('purchasing.orders.colStock')}</th>
                      <th className="px-4 py-3 text-right font-semibold">{t('purchasing.orders.colPrice')}</th>
                      <th className="w-32 px-4 py-3 text-right font-semibold">{t('purchasing.orders.colQuantity')}</th>
                      <th className="px-4 py-3 text-right font-semibold">{t('purchasing.orders.colLineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {catalog.map((item) => {
                      const qty = Number(String(quantities[item.id] ?? '').replace(',', '.')) || 0;
                      const low = item.threshold > 0 && item.stock <= item.threshold;
                      return (
                        <tr key={item.id} className={qty > 0 ? 'bg-cyan-500/5' : ''}>
                          <td className="px-4 py-2 font-medium text-slate-100">{item.name}</td>
                          <td className="px-4 py-2 text-slate-300">{item.pack_label}</td>
                          <td className={`px-4 py-2 text-right tabular-nums ${low ? 'text-amber-400' : 'text-slate-400'}`}>
                            {low && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-label={t('purchasing.orders.low')} />}
                            {format.number(item.stock, { maximumFractionDigits: 3 })} {unitShort(item.unit)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-200">{format.money(item.unit_price)}</td>
                          <td className="px-4 py-2 text-right">
                            <Input
                              inputMode="decimal"
                              value={quantities[item.id] ?? ''}
                              onChange={(e) => setQuantities({ ...quantities, [item.id]: e.target.value })}
                              placeholder="0"
                              className={`h-9 w-24 text-right ${INPUT}`}
                              aria-label={`${t('purchasing.orders.colQuantity')} — ${item.name}`}
                            />
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-100">{qty > 0 ? format.money(Math.round(qty * item.unit_price)) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-900/95 p-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-4">
            {belowMinimum && (
              <p className="flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('purchasing.orders.minOrderWarning', { amount: format.money(supplier!.min_order_amount) })}
              </p>
            )}
            <p className="text-sm text-slate-300">
              {t('purchasing.orders.total')} : <strong className="tabular-nums text-white">{format.money(Math.round(total))}</strong>
            </p>
            <Button type="submit" disabled={pending || !supplierId || total <= 0} className="bg-cyan-600 text-white hover:bg-cyan-700">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('purchasing.orders.saveDraft')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
