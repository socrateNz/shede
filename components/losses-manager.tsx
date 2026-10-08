'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { declareLoss, type LossRow } from '@/app/actions/stock-control';
import { LOSS_REASONS, type LossReason } from '@/lib/stock-constants';
import { useT } from '@/lib/i18n/client';

type ItemType = 'ingredient' | 'product' | 'accompaniment';
export type LossItemOption = { id: string; name: string; type: ItemType; unit?: string | null };

const SELECT_CLASS = 'h-10 w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-50';

/** Pertes déclarées sur la période et déclaration d'une nouvelle perte. */
export function LossesManager({
  losses,
  items,
  periodTabs,
}: {
  losses: LossRow[] | null;
  items: LossItemOption[];
  periodTabs: React.ReactNode;
}) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [itemType, setItemType] = useState<ItemType>('ingredient');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<LossReason>('expired');
  const [note, setNote] = useState('');

  const list = losses ?? [];
  const total = list.reduce((s, l) => s + (l.value ?? 0), 0);
  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of list) map.set(l.reason ?? 'other', (map.get(l.reason ?? 'other') ?? 0) + (l.value ?? 0));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const options = items.filter((i) => i.type === itemType);
  const selected = items.find((i) => i.id === itemId);
  const unitShort = (unit?: string | null) => (unit ? t(`ingredients.unitShort.${unit as 'kg' | 'l' | 'piece'}`) : '');

  function openDialog() {
    setItemId('');
    setQuantity('');
    setReason('expired');
    setNote('');
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await declareLoss({ itemType, itemId, quantity: Number(quantity.replace(',', '.')), reason, note });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('stockControl.losses.declared'));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('stockControl.losses.title')}</h1>
          <p className="max-w-2xl text-slate-400">{t('stockControl.losses.subtitle')}</p>
        </div>
        {losses !== null && (
          <Button type="button" onClick={openDialog} className="bg-red-600 text-white hover:bg-red-700">
            <Plus className="mr-2 h-4 w-4" /> {t('stockControl.losses.declare')}
          </Button>
        )}
      </div>

      {losses === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('stockControl.losses.notInstalled')}</p>
      ) : (
        <>
          <div className="mb-4">{periodTabs}</div>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('stockControl.losses.total')}</p>
              <p className="mt-1 text-3xl font-bold text-red-300">{format.money(total)}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 md:col-span-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">{t('stockControl.losses.byReason')}</p>
              {byReason.length === 0 ? (
                <p className="text-sm text-slate-500">—</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {byReason.map(([key, value]) => (
                    <span key={key} className="rounded-lg bg-slate-900/50 px-3 py-1.5 text-sm text-slate-200">
                      {t(`stockControl.losses.reasons.${key as LossReason}`)} : <strong className="tabular-nums">{format.money(value)}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
            {list.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">{t('stockControl.losses.empty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-300">{t('stockControl.losses.colDate')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('stockControl.losses.colItem')}</TableHead>
                    <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.losses.colQuantity')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('stockControl.losses.colReason')}</TableHead>
                    <TableHead className="text-right font-semibold text-slate-300">{t('stockControl.losses.colValue')}</TableHead>
                    <TableHead className="font-semibold text-slate-300">{t('stockControl.losses.colBy')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((loss) => (
                    <TableRow key={loss.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell className="whitespace-nowrap text-sm text-slate-300">{format.dateTime(loss.created_at)}</TableCell>
                      <TableCell className="text-slate-100">
                        {loss.name}
                        {loss.note && <p className="text-xs text-slate-500">{loss.note}</p>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-200">
                        {format.number(loss.quantity, { maximumFractionDigits: 3 })} {unitShort(loss.unit)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300">{loss.reason ? t(`stockControl.losses.reasons.${loss.reason}`) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-300">{loss.value === null ? '—' : format.money(loss.value)}</TableCell>
                      <TableCell className="text-sm text-slate-400">{loss.user ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogContent className="border-slate-700 bg-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('stockControl.losses.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">{t('stockControl.losses.itemType')}</label>
              <div className="grid grid-cols-3 gap-2">
                {(['ingredient', 'product', 'accompaniment'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setItemType(type);
                      setItemId('');
                    }}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                      itemType === type ? 'border-red-500/60 bg-red-500/10 text-red-200' : 'border-slate-600 text-slate-300'
                    }`}
                  >
                    {t(`stock.itemType.${type}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="loss-item" className="text-sm text-slate-300">{t('stockControl.losses.item')}</label>
              <select id="loss-item" value={itemId} onChange={(e) => setItemId(e.target.value)} required className={SELECT_CLASS}>
                <option value="">{t('stockControl.losses.selectItem')}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              {itemType !== 'ingredient' && <p className="text-xs text-slate-500">{t('stockControl.losses.recipeHint')}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="loss-quantity" className="text-sm text-slate-300">
                  {t('stockControl.losses.quantity')} {selected?.unit ? `(${unitShort(selected.unit)})` : ''}
                </label>
                <Input id="loss-quantity" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="border-slate-600 bg-slate-900/50 text-slate-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="loss-reason" className="text-sm text-slate-300">{t('stockControl.losses.reason')}</label>
                <select id="loss-reason" value={reason} onChange={(e) => setReason(e.target.value as LossReason)} className={SELECT_CLASS}>
                  {LOSS_REASONS.map((r) => (
                    <option key={r} value={r}>{t(`stockControl.losses.reasons.${r}`)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="loss-note" className="text-sm text-slate-300">{t('stockControl.losses.note')}</label>
              <Input id="loss-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t('stockControl.losses.notePlaceholder')} className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending} className="text-slate-300 hover:bg-slate-700">
                {t('stockControl.losses.cancel')}
              </Button>
              <Button type="submit" disabled={pending || !itemId || !quantity} className="bg-red-600 text-white hover:bg-red-700">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('stockControl.losses.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
