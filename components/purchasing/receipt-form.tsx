'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, Loader2, PackageCheck, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { receiveGoods, type CatalogItem, type PurchaseOrderDetail, type PurchasingSupplier } from '@/app/actions/purchasing';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';

const INPUT = 'border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500';

type Line = {
  key: string;
  itemType: 'ingredient' | 'product';
  itemId: string;
  orderLineId: string | null;
  label: string;
  unit: string | null;
  packLabel: string;
  packSize: number;
  ordered: number | null;
  already: number;
  orderedPrice: number | null;
  quantity: string;
  unitPrice: string;
};

const parse = (value: string) => Number(String(value).replace(',', '.')) || 0;

/** Réception d'une livraison : à partir d'un bon de commande, ou directe (catalogue du fournisseur). */
export function ReceiptForm({
  order,
  suppliers = [],
  catalogs = {},
  hasAccounting,
}: {
  order?: PurchaseOrderDetail;
  suppliers?: PurchasingSupplier[];
  catalogs?: Record<string, CatalogItem[]>;
  hasAccounting: boolean;
}) {
  const { t, format } = useT();
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState(order?.supplier_id ?? '');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [note, setNote] = useState('');
  const [toAdd, setToAdd] = useState('');
  const [lines, setLines] = useState<Line[]>(() =>
    (order?.lines ?? [])
      .filter((l) => l.item_id && l.item_type)
      .map((l) => ({
        key: l.id,
        itemType: l.item_type!,
        itemId: l.item_id!,
        orderLineId: l.id,
        label: l.label,
        unit: l.unit,
        packLabel: l.pack_label,
        packSize: l.pack_size,
        ordered: l.quantity,
        already: l.received_quantity,
        orderedPrice: l.unit_price,
        quantity: String(Math.max(0, l.quantity - l.received_quantity)),
        unitPrice: String(l.unit_price),
      }))
  );

  const catalog = useMemo(() => catalogs[supplierId] ?? [], [catalogs, supplierId]);
  const unitShort = (unit: string | null) => (unit ? t(`ingredients.unitShort.${unit as 'kg' | 'l' | 'piece'}`) : t('purchasing.catalog.unitProduct'));
  const total = lines.reduce((s, l) => s + parse(l.quantity) * parse(l.unitPrice), 0);
  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function addFromCatalog(itemId: string) {
    const item = catalog.find((i) => i.id === itemId);
    if (!item) return;
    setLines((prev) => [
      ...prev,
      {
        key: `${item.id}-${Date.now()}`,
        itemType: item.item_type,
        itemId: item.item_id,
        orderLineId: null,
        label: item.name,
        unit: item.unit,
        packLabel: item.pack_label,
        packSize: item.pack_size,
        ordered: null,
        already: 0,
        orderedPrice: null,
        quantity: '1',
        unitPrice: String(item.unit_price),
      },
    ]);
    setToAdd('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(await dialogs.confirm({ description: t('purchasing.receipts.confirm') }))) return;
    startTransition(async () => {
      const result = await receiveGoods({
        supplierId,
        orderId: order?.id ?? null,
        invoiceReference,
        note,
        lines: lines.map((l) => ({
          itemType: l.itemType,
          itemId: l.itemId,
          orderLineId: l.orderLineId,
          label: l.label,
          packLabel: l.packLabel,
          packSize: l.packSize,
          quantity: parse(l.quantity),
          unitPrice: parse(l.unitPrice),
        })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('purchasing.receipts.done', { number: result.data!.number }));
      if (result.data!.accountingWarning) toast.warning(result.data!.accountingWarning, { duration: 10_000 });
      router.push(order ? `/purchasing/orders/${order.id}` : '/purchasing/receipts');
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 pb-28 md:p-8">
      <Link href={order ? `/purchasing/orders/${order.id}` : '/purchasing/receipts'} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300">
        <ArrowLeft className="h-4 w-4" /> {order ? t('purchasing.orders.back') : t('purchasing.receipts.title')}
      </Link>
      <h1 className="mb-6 flex items-center gap-3 text-3xl font-bold text-white">
        <PackageCheck className="h-7 w-7 text-cyan-300" />
        {order ? t('purchasing.receipts.receiveTitle', { number: order.number }) : t('purchasing.receipts.directTitle')}
      </h1>

      <form onSubmit={submit} className="space-y-6">
        <div className="grid gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="r-supplier" className="text-sm text-slate-300">{t('purchasing.receipts.supplier')}</label>
            {order ? (
              <p className="flex h-10 items-center text-slate-100">{order.supplier_name}</p>
            ) : (
              <select
                id="r-supplier"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setLines([]);
                }}
                required
                className="h-10 w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-50"
              >
                <option value="">{t('purchasing.receipts.selectSupplier')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="r-invoice" className="text-sm text-slate-300">{t('purchasing.receipts.invoiceReference')}</label>
            <Input id="r-invoice" value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} maxLength={60} className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="r-note" className="text-sm text-slate-300">{t('purchasing.receipts.note')}</label>
            <Input id="r-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={INPUT} />
          </div>
        </div>

        {supplierId && (
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
            {lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50 text-left text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('purchasing.receipts.colItem')}</th>
                      {order && <th className="px-4 py-3 text-right font-semibold">{t('purchasing.receipts.colOrdered')}</th>}
                      {order && <th className="px-4 py-3 text-right font-semibold">{t('purchasing.receipts.colAlready')}</th>}
                      <th className="w-32 px-4 py-3 text-right font-semibold">{t('purchasing.receipts.colReceived')}</th>
                      <th className="w-36 px-4 py-3 text-right font-semibold">{t('purchasing.receipts.colPrice')}</th>
                      <th className="px-4 py-3 text-right font-semibold">{t('purchasing.receipts.colLineTotal')}</th>
                      {!order && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {lines.map((line) => {
                      const priceChanged = line.orderedPrice !== null && parse(line.unitPrice) !== line.orderedPrice;
                      return (
                        <tr key={line.key}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-slate-100">{line.label}</p>
                            <p className="text-xs text-slate-500">
                              {line.packLabel} · {format.number(line.packSize, { maximumFractionDigits: 3 })} {unitShort(line.unit)}
                            </p>
                          </td>
                          {order && <td className="px-4 py-2 text-right tabular-nums text-slate-300">{format.number(line.ordered ?? 0)}</td>}
                          {order && <td className="px-4 py-2 text-right tabular-nums text-slate-400">{format.number(line.already)}</td>}
                          <td className="px-4 py-2 text-right">
                            <Input inputMode="decimal" value={line.quantity} onChange={(e) => update(line.key, { quantity: e.target.value })} className={`h-9 w-24 text-right ${INPUT}`} aria-label={`${t('purchasing.receipts.colReceived')} — ${line.label}`} />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Input type="number" min="0" value={line.unitPrice} onChange={(e) => update(line.key, { unitPrice: e.target.value })} className={`h-9 w-28 text-right ${INPUT} ${priceChanged ? 'border-amber-500' : ''}`} aria-label={`${t('purchasing.receipts.colPrice')} — ${line.label}`} />
                            {priceChanged && <p className="mt-0.5 text-[10px] text-amber-300">{t('purchasing.receipts.priceChanged')}</p>}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-100">{format.money(Math.round(parse(line.quantity) * parse(line.unitPrice)))}</td>
                          {!order && (
                            <td className="px-2 py-2 text-right">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))} className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10" aria-label={t('purchasing.receipts.remove')}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!order && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-700/50 p-4">
                {catalog.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {t('purchasing.receipts.catalogEmpty')}{' '}
                    <Link href={`/purchasing/suppliers/${supplierId}`} className="text-cyan-300 hover:underline">{t('purchasing.orders.manageCatalog')}</Link>
                  </p>
                ) : (
                  <>
                    <Plus className="h-4 w-4 text-slate-400" />
                    <select
                      value={toAdd}
                      onChange={(e) => addFromCatalog(e.target.value)}
                      className="h-10 min-w-64 rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-50"
                      aria-label={t('purchasing.receipts.addItem')}
                    >
                      <option value="">{t('purchasing.receipts.selectItem')}</option>
                      {catalog.map((i) => (
                        <option key={i.id} value={i.id}>{i.name} — {i.pack_label}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1 text-xs text-slate-400">
          <p className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> {t('purchasing.receipts.costHint')}</p>
          {hasAccounting && <p className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> {t('purchasing.receipts.accountingHint')}</p>}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-900/95 p-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-5xl items-center justify-end gap-4">
            <p className="text-sm text-slate-300">
              {t('purchasing.receipts.total')} : <strong className="tabular-nums text-white">{format.money(Math.round(total))}</strong>
            </p>
            <Button type="submit" disabled={pending || !supplierId || total <= 0} className="bg-cyan-600 text-white hover:bg-cyan-700">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
              {t('purchasing.receipts.submit')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
