'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { saveBankAccount, type BankAccount } from '@/app/actions/bank';
import { useT } from '@/lib/i18n/client';

/** Création ou modification d'un compte bancaire / Mobile Money. */
export function BankAccountDialog({ account, today }: { account?: BankAccount; today: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const value = (name: string) => String(formData.get(name) || '');
    startTransition(async () => {
      const result = await saveBankAccount({
        id: account?.id,
        name: value('name'),
        bankName: value('bankName'),
        accountNumber: value('accountNumber'),
        account: value('account'),
        openingBalance: Number(value('openingBalance') || 0),
        openingDate: value('openingDate'),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.bank.saved'));
      setOpen(false);
      router.refresh();
    });
  }

  const field = 'border-slate-600 bg-slate-900/50 text-slate-100';
  const label = 'block space-y-1 text-sm text-slate-300';

  return (
    <>
      {account ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-8 text-slate-300 hover:bg-slate-700" aria-label={t('accounting.bank.editAccount')}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> {t('accounting.bank.newAccount')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{account ? t('accounting.bank.editAccount') : t('accounting.bank.newAccount')}</DialogTitle>
          </DialogHeader>
          <form action={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={`${label} sm:col-span-2`}>
              {t('accounting.bank.name')}
              <Input name="name" required defaultValue={account?.name ?? ''} placeholder={t('accounting.bank.namePlaceholder')} className={field} />
            </label>
            <label className={label}>
              {t('accounting.bank.bankName')}
              <Input name="bankName" defaultValue={account?.bank_name ?? ''} className={field} />
            </label>
            <label className={label}>
              {t('accounting.bank.accountNumber')}
              <Input name="accountNumber" defaultValue={account?.account_number ?? ''} className={field} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              {t('accounting.bank.account')}
              <Input name="account" required pattern="5[0-9]{1,11}" defaultValue={account?.account ?? '521'} className={`${field} font-mono`} />
              <span className="text-xs text-slate-500">{t('accounting.bank.accountHint')}</span>
            </label>
            <label className={label}>
              {t('accounting.bank.openingBalance')}
              <Input name="openingBalance" type="number" step="any" defaultValue={account?.opening_balance ?? 0} className={field} />
            </label>
            <label className={label}>
              {t('accounting.bank.openingDate')}
              <Input name="openingDate" type="date" defaultValue={account?.opening_date ?? today} className={field} />
            </label>
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
