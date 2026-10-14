'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/** Champ mot de passe avec un œil pour afficher / masquer la saisie. */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const { t } = useT();
  const [visible, setVisible] = React.useState(false);
  const label = visible ? t('common.hidePassword') : t('common.showPassword');

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

export { PasswordInput };
