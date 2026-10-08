'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Loader2, MoreVertical, Pencil, Plus, ShoppingCart, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addSupplierItems, deleteSupplierItem, saveSupplierItem, type CatalogItem, type CatalogOption, type PurchasingSupplier } from '@/app/actions/purchasing';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';

const INPUT = 'border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500';
const SELECT = 'h-10 w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-50 disabled:opacity-60';

type Form = { itemType: 'ingredient' | 'product'; itemId: string; reference: string; packLabel: string; packSize: string; unitPrice: string; isPreferred: boolean };
const EMPTY: Form = { itemType: 'ingredient', itemId: '', reference: '', packLabel: '', packSize: '1', unitPrice: '', isPreferred: false };

/** Ligne de l'ajout en lot. */
type Row = Form & { key: string };
const newRow = (itemType: Form['itemType'] = 'ingredient'): Row => ({ ...EMPTY, itemType, key: Math.random().toString(36).slice(2) });
const ROW_INPUT = 'h-9 border-slate-600 bg-slate-900/50 text-sm text-slate-50 placeholder:text-slate-500';
const ROW_SELECT = 'h-9 w-full rounded-md border border-slate-600 bg-slate-900/50 px-2 text-sm text-slate-50';

/** Catalogue d'un fournisseur : articles, conditionnements et prix HT. */
export function CatalogManager({
  supplier,
  items,
  options,
  canManage,
}: {
  supplier: PurchasingSupplier;
  items: CatalogItem[];
  options: CatalogOption[];
  canManage: boolean;
}) {
  const { t, format } = useT();
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const unitShort = (unit: string | null) => (unit ? t(`ingredients.unitShort.${unit as 'kg' | 'l' | 'piece'}`) : t('purchasing.catalog.unitProduct'));
  const inCatalog = new Set(items.map((i) => `${i.item_type}:${i.item_id}`));
  const choices = options.filter(
    (o) => o.item_type === form.itemType && (!inCatalog.has(`${o.item_type}:${o.id}`) || (editing !== 'new' && editing?.item_id === o.id))
  );
  const selectedUnit = options.find((o) => o.id === form.itemId)?.unit ?? null;

  function openEdit(item: CatalogItem | 'new') {
    if (item === 'new') setRows([newRow(), newRow()]);
    setForm(
      item === 'new'
        ? EMPTY
        : {
            itemType: item.item_type,
            itemId: item.item_id,
            reference: item.reference ?? '',
            packLabel: item.pack_label,
            packSize: String(item.pack_size),
            unitPrice: String(item.unit_price),
            isPreferred: item.is_preferred,
          }
    );
    setEditing(item);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveSupplierItem({
        id: editing && editing !== 'new' ? editing.id : undefined,
        supplierId: supplier.id,
        itemType: form.itemType,
        itemId: form.itemId,
        reference: form.reference,
        packLabel: form.packLabel,
        packSize: Number(form.packSize.replace(',', '.')),
        unitPrice: Number(form.unitPrice),
        isPreferred: form.isPreferred,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('purchasing.catalog.saved'));
      setEditing(null);
      router.refresh();
    });
  }

  const updateRow = (key: string, patch: Partial<Form>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // Lignes retenues : un article choisi
  const filledRows = rows.filter((r) => r.itemId);
  const rowsReady = filledRows.length > 0 && filledRows.every((r) => r.packLabel.trim() && Number(r.packSize.replace(',', '.')) > 0 && r.unitPrice !== '');

  function submitMany(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addSupplierItems(
        supplier.id,
        filledRows.map((r) => ({
          itemType: r.itemType,
          itemId: r.itemId,
          reference: r.reference,
          packLabel: r.packLabel,
          packSize: Number(r.packSize.replace(',', '.')),
          unitPrice: Number(r.unitPrice),
          isPreferred: r.isPreferred,
        }))
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('purchasing.catalog.savedMany', { count: result.data?.count ?? filledRows.length }));
      setEditing(null);
      router.refresh();
    });
  }

  async function remove(item: CatalogItem) {
    if (!(await dialogs.confirm({ description: t('purchasing.catalog.confirmDelete', { name: item.name }), destructive: true }))) return;
    startTransition(async () => {
      const result = await deleteSupplierItem(item.id);
      if (!result.success) toast.error(result.error);
      else {
        toast.success(t('purchasing.catalog.deleted'));
        router.refresh();
      }
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <Link href="/purchasing/suppliers" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300">
        <ArrowLeft className="h-4 w-4" /> {t('purchasing.catalog.back')}
      </Link>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-white">
            <BookOpen className="h-7 w-7 text-cyan-300" />
            {t('purchasing.catalog.title', { supplier: supplier.name })}
          </h1>
          <p className="max-w-2xl text-slate-400">{t('purchasing.catalog.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {canManage && items.length > 0 && (
            <Link href={`/purchasing/orders/new?supplier=${supplier.id}`}>
              <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                <ShoppingCart className="mr-2 h-4 w-4" /> {t('purchasing.catalog.newOrder')}
              </Button>
            </Link>
          )}
          {canManage && (
            <Button type="button" onClick={() => openEdit('new')} className="bg-cyan-600 text-white hover:bg-cyan-700">
              <Plus className="mr-2 h-4 w-4" /> {t('purchasing.catalog.addButton')}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
        {items.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-400">{t('purchasing.catalog.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-300">{t('purchasing.catalog.colItem')}</TableHead>
                <TableHead className="font-semibold text-slate-300">{t('purchasing.catalog.colType')}</TableHead>
                <TableHead className="font-semibold text-slate-300">{t('purchasing.catalog.colReference')}</TableHead>
                <TableHead className="font-semibold text-slate-300">{t('purchasing.catalog.colPack')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.catalog.colPrice')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.catalog.colUnitCost')}</TableHead>
                <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.catalog.colStock')}</TableHead>
                {canManage && <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.catalog.colActions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const low = item.threshold > 0 && item.stock <= item.threshold;
                return (
                  <TableRow key={item.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="font-medium text-slate-50">
                      {item.name}
                      {item.is_preferred && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                          <Star className="h-3 w-3" /> {t('purchasing.catalog.preferredBadge')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">
                      {item.item_type === 'ingredient' ? t('purchasing.catalog.ingredient') : t('purchasing.catalog.product')}
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">{item.reference ?? '—'}</TableCell>
                    <TableCell className="text-sm text-slate-200">
                      {item.pack_label}
                      <p className="text-xs text-slate-500">
                        {format.number(item.pack_size, { maximumFractionDigits: 3 })} {unitShort(item.unit)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-100">{format.money(item.unit_price)}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-300">
                      {t('purchasing.catalog.unitCost', { amount: format.money(Math.round(item.unit_price / item.pack_size)), unit: unitShort(item.unit) })}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${low ? 'text-amber-400' : 'text-slate-300'}`}>
                      {format.number(item.stock, { maximumFractionDigits: 3 })} {unitShort(item.unit)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label={t('purchasing.catalog.colActions')}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 border-slate-700 bg-slate-800 text-slate-200">
                            <DropdownMenuItem onClick={() => openEdit(item)} className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700">
                              <Pencil className="h-4 w-4 text-blue-400" /> {t('purchasing.catalog.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem onClick={() => remove(item)} disabled={pending} className="cursor-pointer gap-2 text-red-400 hover:bg-slate-700 focus:bg-slate-700">
                              <Trash2 className="h-4 w-4" /> {t('purchasing.catalog.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !pending && setEditing(null)}>
        <DialogContent className={`max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 ${editing === 'new' ? 'sm:max-w-6xl' : 'sm:max-w-md'}`}>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? t('purchasing.catalog.addTitle') : t('purchasing.catalog.editTitle')}</DialogTitle>
          </DialogHeader>

          {editing === 'new' ? (
            <form onSubmit={submitMany} className="space-y-3">
              <p className="text-xs text-slate-400">{t('purchasing.catalog.addHint')}</p>
              {/* En-têtes (écran large) */}
              <div className="hidden grid-cols-[130px_minmax(160px,1.6fr)_minmax(140px,1.3fr)_90px_120px_minmax(100px,1fr)_70px_36px] gap-2 px-1 text-xs text-slate-400 lg:grid">
                <span>{t('purchasing.catalog.itemType')}</span>
                <span>{t('purchasing.catalog.item')}</span>
                <span>{t('purchasing.catalog.packLabel')}</span>
                <span>{t('purchasing.catalog.packSize', { unit: '' }).replace(/\s*\(\)\s*$/, '')}</span>
                <span>{t('purchasing.catalog.unitPrice')}</span>
                <span>{t('purchasing.catalog.colReference')}</span>
                <span>{t('purchasing.catalog.preferredBadge')}</span>
                <span />
              </div>
              <ul className="space-y-2">
                {rows.map((row) => {
                  // Articles proposés : du bon type, ni déjà au catalogue, ni choisis sur une autre ligne
                  const taken = new Set(rows.filter((r) => r.key !== row.key && r.itemId).map((r) => `${r.itemType}:${r.itemId}`));
                  const choicesForRow = options.filter(
                    (o) => o.item_type === row.itemType && !inCatalog.has(`${o.item_type}:${o.id}`) && !taken.has(`${o.item_type}:${o.id}`)
                  );
                  const unit = options.find((o) => o.id === row.itemId)?.unit ?? null;
                  return (
                    <li
                      key={row.key}
                      className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700/60 bg-slate-900/30 p-2 lg:grid-cols-[130px_minmax(160px,1.6fr)_minmax(140px,1.3fr)_90px_120px_minmax(100px,1fr)_70px_36px] lg:items-center lg:border-0 lg:bg-transparent lg:p-0"
                    >
                      <select value={row.itemType} onChange={(e) => updateRow(row.key, { itemType: e.target.value as Form['itemType'], itemId: '' })} className={ROW_SELECT} aria-label={t('purchasing.catalog.itemType')}>
                        <option value="ingredient">{t('purchasing.catalog.ingredient')}</option>
                        <option value="product">{t('purchasing.catalog.product')}</option>
                      </select>
                      <select value={row.itemId} onChange={(e) => updateRow(row.key, { itemId: e.target.value })} className={ROW_SELECT} aria-label={t('purchasing.catalog.item')}>
                        <option value="">{t('purchasing.catalog.selectItem')}</option>
                        {choicesForRow.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}{o.unit ? ` (${unitShort(o.unit)})` : ''}</option>
                        ))}
                      </select>
                      <Input value={row.packLabel} onChange={(e) => updateRow(row.key, { packLabel: e.target.value })} placeholder={t('purchasing.catalog.packLabelPlaceholder')} maxLength={60} className={`col-span-2 lg:col-span-1 ${ROW_INPUT}`} aria-label={t('purchasing.catalog.packLabel')} />
                      <div className="flex items-center gap-1">
                        <Input inputMode="decimal" value={row.packSize} onChange={(e) => updateRow(row.key, { packSize: e.target.value })} className={ROW_INPUT} aria-label={t('purchasing.catalog.packSize', { unit: unitShort(unit) })} />
                        <span className="w-9 shrink-0 truncate text-[11px] text-slate-500">{unitShort(unit)}</span>
                      </div>
                      <Input type="number" min="0" value={row.unitPrice} onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })} placeholder="0" className={ROW_INPUT} aria-label={t('purchasing.catalog.unitPrice')} />
                      <Input value={row.reference} onChange={(e) => updateRow(row.key, { reference: e.target.value })} maxLength={60} className={ROW_INPUT} aria-label={t('purchasing.catalog.reference')} />
                      <label className="flex items-center justify-center gap-1.5 text-xs text-slate-300 lg:justify-center" title={t('purchasing.catalog.preferred')}>
                        <input type="checkbox" checked={row.isPreferred} onChange={(e) => updateRow(row.key, { isPreferred: e.target.checked })} className="h-4 w-4" />
                        <span className="lg:hidden">{t('purchasing.catalog.preferredBadge')}</span>
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== row.key) : [newRow()]))}
                        className="h-9 w-9 justify-self-end p-0 text-red-400 hover:bg-red-500/10"
                        aria-label={t('purchasing.catalog.removeLine')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, newRow(prev[prev.length - 1]?.itemType)])} className="border-slate-600 text-slate-200 hover:bg-slate-700">
                <Plus className="mr-1.5 h-4 w-4" /> {t('purchasing.catalog.addLine')}
              </Button>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={pending} className="text-slate-300 hover:bg-slate-700">
                  {t('purchasing.catalog.cancel')}
                </Button>
                <Button type="submit" disabled={pending || !rowsReady} className="bg-cyan-600 text-white hover:bg-cyan-700">
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('purchasing.catalog.saveMany', { count: filledRows.length })}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm text-slate-300">{t('purchasing.catalog.item')}</p>
                <p className="font-medium text-slate-100">{typeof editing === 'object' && editing ? editing.name : ''}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="ci-pack" className="text-sm text-slate-300">{t('purchasing.catalog.packLabel')}</label>
                  <Input id="ci-pack" value={form.packLabel} onChange={(e) => setForm({ ...form, packLabel: e.target.value })} placeholder={t('purchasing.catalog.packLabelPlaceholder')} maxLength={60} required className={INPUT} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ci-size" className="text-sm text-slate-300">{t('purchasing.catalog.packSize', { unit: unitShort(selectedUnit) })}</label>
                  <Input id="ci-size" inputMode="decimal" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} required className={INPUT} />
                </div>
              </div>
              <p className="-mt-2 text-xs text-slate-500">{t('purchasing.catalog.packSizeHint')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="ci-price" className="text-sm text-slate-300">{t('purchasing.catalog.unitPrice')}</label>
                  <Input id="ci-price" type="number" min="0" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required className={INPUT} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ci-ref" className="text-sm text-slate-300">{t('purchasing.catalog.reference')}</label>
                  <Input id="ci-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={60} className={INPUT} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.isPreferred} onChange={(e) => setForm({ ...form, isPreferred: e.target.checked })} className="h-4 w-4" />
                {t('purchasing.catalog.preferred')}
              </label>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={pending} className="text-slate-300 hover:bg-slate-700">
                  {t('purchasing.catalog.cancel')}
                </Button>
                <Button type="submit" disabled={pending || !form.itemId || !form.packLabel.trim()} className="bg-cyan-600 text-white hover:bg-cyan-700">
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('purchasing.catalog.save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
