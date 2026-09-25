'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/client';

type ActionState = { success: boolean; error: string };

interface AdminAccountFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}

const inputClass =
  'bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20';

/** Crée un compte administrateur (champs adminFirstName, adminLastName, adminEmail, adminPassword). */
export function AdminAccountForm({ action, submitLabel }: AdminAccountFormProps) {
  const router = useRouter();
  const { t } = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, { success: false, error: '' });

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input name="adminFirstName" placeholder={t('org.adminForm.firstName')} aria-label={t('org.adminForm.firstName')} className={inputClass} required />
        <Input name="adminLastName" placeholder={t('org.adminForm.lastName')} aria-label={t('org.adminForm.lastName')} className={inputClass} required />
        <Input name="adminEmail" type="email" placeholder={t('org.adminForm.email')} aria-label={t('org.adminForm.email')} className={inputClass} required />
        <Input name="adminPassword" type="password" placeholder={t('org.adminForm.password')} aria-label={t('org.adminForm.password')} minLength={8} className={inputClass} required />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-green-400">{t('org.adminForm.created')}</p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        size="sm"
        className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
      >
        <UserPlus className="w-4 h-4 mr-2" />
        {isPending ? t('org.adminForm.creating') : submitLabel}
      </Button>
    </form>
  );
}
