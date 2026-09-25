'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { resetPassword } from '@/app/actions/password';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/client';

const inputClass = 'bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(resetPassword, { success: false, error: '' });

  useEffect(() => {
    if (state.success) router.push('/login?reset=1');
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          {t('auth.reset.newPassword')}
        </label>
        <Input id="password" type="password" name="password" minLength={8} placeholder={t('auth.reset.newPasswordPlaceholder')} className={inputClass} required />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm" className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          {t('auth.reset.confirm')}
        </label>
        <Input id="confirm" type="password" name="confirm" minLength={8} placeholder="••••••••" className={inputClass} required />
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-5 rounded-xl disabled:opacity-50"
      >
        {isPending ? t('auth.reset.submitting') : t('auth.reset.submit')}
      </Button>
    </form>
  );
}
