'use client';

import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addCustomAccount } from '@/app/actions/accounting';
import { useT } from '@/lib/i18n/client';

export function AccountForm() {
  const { t } = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          const result = await addCustomAccount(String(formData.get('number') || ''), String(formData.get('label') || ''));
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(t('accounting.accounts.added'));
          formRef.current?.reset();
          router.refresh();
        })
      }
      className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5"
    >
      <h3 className="font-semibold text-slate-100">{t('accounting.accounts.add')}</h3>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
        <label className="space-y-1 text-sm text-slate-300">
          {t('accounting.accounts.number')}
          <Input name="number" required inputMode="numeric" pattern="[1-8][0-9]{2,11}" placeholder={t('accounting.accounts.numberPlaceholder')} className="border-slate-600 bg-slate-900/50 font-mono text-slate-100" />
        </label>
        <label className="space-y-1 text-sm text-slate-300">
          {t('accounting.accounts.label')}
          <Input name="label" required placeholder={t('accounting.accounts.labelPlaceholder')} className="border-slate-600 bg-slate-900/50 text-slate-100" />
        </label>
        <Button type="submit" disabled={pending} className="self-end bg-emerald-600 text-white hover:bg-emerald-700">
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          {t('accounting.accounts.add')}
        </Button>
      </div>
      <p className="text-xs text-slate-500">{t('accounting.accounts.hint')}</p>
    </form>
  );
}
