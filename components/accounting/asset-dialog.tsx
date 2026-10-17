'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { postDepreciations, saveFixedAsset, type FixedAsset } from '@/app/actions/closing';
import { useDialogs } from '@/components/dialog-provider';
import { ASSET_CATEGORIES, ASSET_CATEGORY_KEYS, type AssetCategory } from '@/lib/fixed-assets';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

/** Création ou modification d'une immobilisation. */
export function AssetDialog({ asset, today, locked = false }: { asset?: FixedAsset; today: string; locked?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<AssetCategory>(asset?.category ?? 'equipment');
  const [life, setLife] = useState(String(asset?.useful_life_months ?? ASSET_CATEGORIES.equipment.months));
  const [postAcquisition, setPostAcquisition] = useState(true);
  const depreciable = ASSET_CATEGORIES[category].months > 0;

  function submit(formData: FormData) {
    const value = (name: string) => String(formData.get(name) || '');
    startTransition(async () => {
      const result = await saveFixedAsset({
        id: asset?.id,
        name: value('name'),
        category,
        acquisitionDate: value('acquisitionDate'),
        inServiceDate: value('inServiceDate'),
        cost: Number(value('cost')),
        usefulLifeMonths: Number(life),
        reference: value('reference'),
        notes: value('notes'),
        postAcquisition: !asset && postAcquisition,
      });
      if (!result.success) return void toast.error(result.error);
      toast.success(t('accounting.assets.saved'));
      if (result.data?.accountingWarning) toast.warning(result.data.accountingWarning, { duration: 8000 });
      setOpen(false);
      router.refresh();
    });
  }

  const field = 'border-slate-600 bg-slate-900/50 text-slate-100';
  const label = 'block space-y-1 text-sm text-slate-300';
  const disabled = Boolean(asset && locked);

  return (
    <>
      {asset ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-8 text-slate-300 hover:bg-slate-700" aria-label={t('accounting.assets.edit')}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> {t('accounting.assets.new')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{asset ? t('accounting.assets.edit') : t('accounting.assets.new')}</DialogTitle>
          </DialogHeader>
          {disabled && <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-300">{t('accounting.assets.lockedFields')}</p>}
          <form action={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={`${label} sm:col-span-2`}>
              {t('accounting.assets.name')}
              <Input name="name" required defaultValue={asset?.name ?? ''} placeholder={t('accounting.assets.namePlaceholder')} className={field} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              {t('accounting.assets.category')}
              <select
                value={category}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.value as AssetCategory;
                  setCategory(next);
                  setLife(String(ASSET_CATEGORIES[next].months));
                }}
                className="h-9 w-full rounded-md border border-slate-600 bg-slate-900/50 px-2 text-sm text-slate-100"
              >
                {ASSET_CATEGORY_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {t(`accounting.assets.categories.${c}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              {t('accounting.assets.acquisitionDate')}
              <Input name="acquisitionDate" type="date" required disabled={disabled} defaultValue={asset?.acquisition_date ?? today} className={field} />
            </label>
            <label className={label}>
              {t('accounting.assets.inServiceDate')}
              <Input name="inServiceDate" type="date" required disabled={disabled} defaultValue={asset?.in_service_date ?? today} className={field} />
            </label>
            <label className={label}>
              {t('accounting.assets.cost')}
              <Input name="cost" type="number" min={1} step="any" required disabled={disabled} defaultValue={asset?.cost ?? ''} className={field} />
            </label>
            <label className={label}>
              {t('accounting.assets.life')}
              {depreciable ? (
                <Input type="number" min={1} max={1200} step={1} required disabled={disabled} value={life} onChange={(e) => setLife(e.target.value)} className={field} />
              ) : (
                <span className="flex h-9 items-center text-sm text-slate-500">{t('accounting.assets.notDepreciable')}</span>
              )}
              {depreciable && <span className="text-xs text-slate-500">{t('accounting.assets.lifeHint')}</span>}
            </label>
            <label className={`${label} sm:col-span-2`}>
              {t('accounting.assets.reference')}
              <Input name="reference" defaultValue={asset?.reference ?? ''} className={field} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              {t('accounting.assets.notes')}
              <textarea name="notes" rows={2} defaultValue={asset?.notes ?? ''} className={`w-full rounded-md border px-3 py-2 text-sm ${field}`} />
            </label>
            {!asset && (
              <label className="flex items-start gap-2 text-sm text-slate-300 sm:col-span-2">
                <input type="checkbox" checked={postAcquisition} onChange={(e) => setPostAcquisition(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
                <span>
                  {t('accounting.assets.postAcquisition')}
                  <span className="block text-xs text-slate-500">{t('accounting.assets.postAcquisitionHint')}</span>
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-300">
                {t('accounting.common.cancel')}
              </Button>
              <Button type="submit" disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('accounting.common.save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Passe les dotations jusqu'à la date affichée (confirmation demandée avant l'action). */
export function DepreciationButton({ asOf, pendingTotal }: { asOf: string; pendingTotal: number }) {
  const { t, format } = useT();
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending || pendingTotal <= 0}
      onClick={async () => {
        if (!(await dialogs.confirm({ description: t('accounting.assets.postDepreciationConfirm', { amount: format.money(pendingTotal), date: format.date(asOf) }) }))) return;
        startTransition(async () => {
          const result = await postDepreciations(asOf);
          if (!result.success) return void toast.error(result.error);
          if (!result.data?.assets) toast.message(t('accounting.assets.nothingToPost'));
          else toast.success(t('accounting.assets.posted', { amount: format.money(result.data.amount), count: result.data.assets }));
          router.refresh();
        });
      }}
      className="bg-emerald-600 text-white hover:bg-emerald-700"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
      {t('accounting.assets.postDepreciation', { date: format.date(asOf) })}
    </Button>
  );
}
