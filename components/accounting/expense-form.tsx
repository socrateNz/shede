'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ImageUpload } from '@/components/image-upload';
import { createExpense, saveSupplier } from '@/app/actions/accounting';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KEYS, PAYMENT_METHODS, type ExpenseCategory } from '@/lib/accounting/mapping';
import { CAMEROON_VAT_RATE } from '@/lib/tax';
import { useT } from '@/lib/i18n/client';

const fieldClass = 'w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-100';
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** TVA contenue dans un montant TTC au taux normal camerounais. */
function vatFromTtc(ttc: number) {
  return Math.round(ttc - ttc / (1 + CAMEROON_VAT_RATE / 100));
}

export function ExpenseFormDialog({ suppliers: initialSuppliers }: { suppliers: { id: string; name: string }[] }) {
  const { t, format } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState(initialSuppliers);

  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [label, setLabel] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [newSupplier, setNewSupplier] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [withVat, setWithVat] = useState(true);
  const [tax, setTax] = useState('');
  const [taxEdited, setTaxEdited] = useState(false);
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState<string>('CASH');
  const [attachment, setAttachment] = useState<string | null>(null);

  const hasVat = EXPENSE_CATEGORIES[category].vat !== null;
  const ttc = Math.round(Number(amount) || 0);
  const taxValue = hasVat && withVat ? (taxEdited ? Math.round(Number(tax) || 0) : vatFromTtc(ttc)) : 0;
  const sortedCategories = useMemo(
    () => [...EXPENSE_CATEGORY_KEYS].sort((a, b) => t(`accounting.categories.${a}`).localeCompare(t(`accounting.categories.${b}`))),
    [t]
  );

  function reset() {
    setLabel('');
    setSupplierId('');
    setNewSupplier(null);
    setDate(today());
    setReference('');
    setAmount('');
    setTax('');
    setTaxEdited(false);
    setAttachment(null);
  }

  function submit() {
    startTransition(async () => {
      let supplier = supplierId || null;
      if (newSupplier !== null && newSupplier.trim()) {
        const created = await saveSupplier({ name: newSupplier });
        if (!created.success) {
          toast.error(created.error);
          return;
        }
        supplier = created.data!.id;
        setSuppliers((list) => [...list, { id: supplier!, name: newSupplier.trim() }]);
      }
      const result = await createExpense({
        category,
        label,
        supplierId: supplier,
        date,
        reference,
        amountTtc: ttc,
        taxAmount: taxValue,
        paid,
        paymentMethod: paid ? method : null,
        attachmentUrl: attachment,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.expenses.form.created'));
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          {t('accounting.expenses.new')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('accounting.expenses.new')}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-300">
              {t('accounting.expenses.form.category')}
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={fieldClass}>
                {sortedCategories.map((key) => (
                  <option key={key} value={key}>
                    {t(`accounting.categories.${key}`)}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-slate-500">
                {t('accounting.expenses.form.account', { account: EXPENSE_CATEGORIES[category].account })}
              </span>
            </label>
            <label className="space-y-1 text-sm text-slate-300">
              {t('accounting.expenses.form.date')}
              <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required className="border-slate-600 bg-slate-900/50 text-slate-100 [color-scheme:dark]" />
            </label>
          </div>

          <label className="block space-y-1 text-sm text-slate-300">
            {t('accounting.expenses.form.label')}
            <Input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder={t('accounting.expenses.form.labelPlaceholder')} className="border-slate-600 bg-slate-900/50 text-slate-100" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-300">
              {t('accounting.expenses.form.supplier')}
              {newSupplier === null ? (
                <select
                  value={supplierId}
                  onChange={(e) => {
                    if (e.target.value === '__new__') setNewSupplier('');
                    else setSupplierId(e.target.value);
                  }}
                  className={fieldClass}
                >
                  <option value="">{t('accounting.expenses.form.noSupplier')}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="__new__">{t('accounting.expenses.form.newSupplier')}</option>
                </select>
              ) : (
                <Input
                  autoFocus
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  placeholder={t('accounting.expenses.form.supplierName')}
                  className="border-slate-600 bg-slate-900/50 text-slate-100"
                />
              )}
            </label>
            <label className="space-y-1 text-sm text-slate-300">
              {t('accounting.expenses.form.reference')}
              <Input value={reference} onChange={(e) => setReference(e.target.value)} className="border-slate-600 bg-slate-900/50 text-slate-100" />
            </label>
          </div>

          <div className="grid gap-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-300">
              {t('accounting.expenses.form.amountTtc')}
              <Input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="border-slate-600 bg-slate-900/50 text-lg font-semibold text-slate-100" />
            </label>
            <div className="space-y-2 text-sm text-slate-300">
              {hasVat ? (
                <>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={withVat} onChange={(e) => setWithVat(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
                    {t('accounting.expenses.form.withVat')}
                  </label>
                  {withVat && (
                    <label className="block space-y-1">
                      {t('accounting.expenses.form.taxAmount')}
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={taxEdited ? tax : String(taxValue)}
                        onChange={(e) => {
                          setTaxEdited(true);
                          setTax(e.target.value);
                        }}
                        className="border-slate-600 bg-slate-900/50 text-slate-100"
                      />
                      <span className="block text-xs text-slate-500">{t('accounting.expenses.form.taxHint')}</span>
                    </label>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">{t('accounting.expenses.form.noVatCategory')}</p>
              )}
            </div>
            {ttc > 0 && (
              <p className="text-xs text-slate-400 sm:col-span-2">
                {t('accounting.expenses.form.amountHt', { amount: format.money(Math.max(0, ttc - taxValue)) })}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              {t('accounting.expenses.form.paidNow')}
            </label>
            {paid && (
              <label className="space-y-1 text-sm text-slate-300">
                {t('accounting.expenses.form.paymentMethod')}
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(`accounting.paymentMethods.${m}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="space-y-1 text-sm text-slate-300">
            <p>{t('accounting.expenses.form.attachment')}</p>
            <div className="max-w-xs">
              <ImageUpload value={attachment} onChange={setAttachment} disabled={pending} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-700 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-300">
              {t('accounting.common.cancel')}
            </Button>
            <Button type="submit" disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? t('accounting.common.saving') : t('accounting.common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
