'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { saveCustomer, setCustomerActive, type Customer } from '@/app/actions/invoicing';
import { useT } from '@/lib/i18n/client';

/** Création (sans `customer`) ou modification d'un client facturé. `onCreated` : sélection dans un formulaire. */
export function CustomerDialog({
  customer,
  onCreated,
  trigger = 'button',
}: {
  customer?: Customer;
  onCreated?: (id: string) => void;
  trigger?: 'button' | 'link';
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const value = (name: string) => String(formData.get(name) || '');
    startTransition(async () => {
      const result = await saveCustomer({
        id: customer?.id,
        name: value('name'),
        contactName: value('contactName'),
        phone: value('phone'),
        email: value('email'),
        niu: value('niu'),
        rccm: value('rccm'),
        address: value('address'),
        city: value('city'),
        paymentTermsDays: Number(value('paymentTerms') || 30),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.customers.saved'));
      setOpen(false);
      if (!customer && result.data) onCreated?.(result.data.id);
      router.refresh();
    });
  }

  const field = 'border-slate-600 bg-slate-900/50 text-slate-100';
  const fields: { name: string; label: string; value?: string | number | null; type?: string; required?: boolean; wide?: boolean }[] = [
    { name: 'name', label: t('accounting.customers.name'), value: customer?.name, required: true, wide: true },
    { name: 'contactName', label: t('accounting.customers.contactName'), value: customer?.contact_name },
    { name: 'phone', label: t('accounting.customers.phone'), value: customer?.phone, type: 'tel' },
    { name: 'email', label: t('accounting.customers.email'), value: customer?.email, type: 'email' },
    { name: 'paymentTerms', label: t('accounting.customers.paymentTerms'), value: customer?.payment_terms_days ?? 30, type: 'number' },
    { name: 'niu', label: t('accounting.customers.niu'), value: customer?.niu },
    { name: 'rccm', label: t('accounting.customers.rccm'), value: customer?.rccm },
    { name: 'address', label: t('accounting.customers.address'), value: customer?.address },
    { name: 'city', label: t('accounting.customers.city'), value: customer?.city },
  ];

  return (
    <>
      {customer ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-8 text-slate-300 hover:bg-slate-700" aria-label={t('accounting.customers.edit')}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : trigger === 'link' ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300">
          <Plus className="h-4 w-4" aria-hidden /> {t('accounting.customers.new')}
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          {t('accounting.customers.new')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{customer ? t('accounting.customers.edit') : t('accounting.customers.new')}</DialogTitle>
          </DialogHeader>
          <form action={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.name} className={`block space-y-1 text-sm text-slate-300 ${f.wide ? 'sm:col-span-2' : ''}`}>
                {f.label}
                <Input
                  name={f.name}
                  type={f.type ?? 'text'}
                  min={f.type === 'number' ? 0 : undefined}
                  max={f.type === 'number' ? 365 : undefined}
                  defaultValue={f.value ?? ''}
                  required={f.required}
                  className={field}
                />
              </label>
            ))}
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

export function CustomerToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setCustomerActive(id, !isActive);
          if (!result.success) toast.error(result.error);
          else router.refresh();
        })
      }
      className="h-8 text-slate-300 hover:bg-slate-700"
    >
      {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Power className="mr-1 h-4 w-4" />}
      {isActive ? t('accounting.customers.deactivate') : t('accounting.customers.activate')}
    </Button>
  );
}
