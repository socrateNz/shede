'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { saveSupplier, setSupplierActive, type Supplier } from '@/app/actions/accounting';
import { useT } from '@/lib/i18n/client';

/** Création (sans `supplier`) ou modification d'un fournisseur. */
export function SupplierDialog({ supplier }: { supplier?: Supplier }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveSupplier({
        id: supplier?.id,
        name: String(formData.get('name') || ''),
        phone: String(formData.get('phone') || ''),
        email: String(formData.get('email') || ''),
        niu: String(formData.get('niu') || ''),
        address: String(formData.get('address') || ''),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.suppliers.saved'));
      setOpen(false);
      router.refresh();
    });
  }

  const fields = [
    { name: 'name', label: t('accounting.suppliers.name'), required: true, value: supplier?.name },
    { name: 'phone', label: t('accounting.suppliers.phone'), value: supplier?.phone },
    { name: 'email', label: t('accounting.suppliers.email'), value: supplier?.email, type: 'email' },
    { name: 'niu', label: t('accounting.suppliers.niu'), value: supplier?.niu },
    { name: 'address', label: t('accounting.suppliers.address'), value: supplier?.address },
  ];

  return (
    <>
      {supplier ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-8 text-slate-300 hover:bg-slate-700" aria-label={t('accounting.suppliers.edit')}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          {t('accounting.suppliers.new')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-slate-700 bg-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{supplier ? t('accounting.suppliers.edit') : t('accounting.suppliers.new')}</DialogTitle>
          </DialogHeader>
          <form action={submit} className="space-y-3">
            {fields.map((f) => (
              <label key={f.name} className="block space-y-1 text-sm text-slate-300">
                {f.label}
                <Input
                  name={f.name}
                  type={f.type ?? 'text'}
                  defaultValue={f.value ?? ''}
                  required={f.required}
                  className="border-slate-600 bg-slate-900/50 text-slate-100"
                />
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-2">
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

export function SupplierToggle({ id, isActive }: { id: string; isActive: boolean }) {
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
          const result = await setSupplierActive(id, !isActive);
          if (!result.success) toast.error(result.error);
          else router.refresh();
        })
      }
      className="h-8 text-slate-300 hover:bg-slate-700"
    >
      {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Power className="mr-1 h-4 w-4" />}
      {isActive ? t('accounting.suppliers.deactivate') : t('accounting.suppliers.activate')}
    </Button>
  );
}
