'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocale } from '@/app/actions/locale';
import { LOCALES, type Locale } from '@/lib/i18n/config';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/** Bascule FR / EN. `tone` adapte les couleurs au fond (sombre ou clair). */
export function LanguageSwitcher({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const { locale, t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border p-0.5 text-xs font-semibold',
        tone === 'dark' ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white',
        pending && 'opacity-60',
        className
      )}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => change(code)}
          disabled={pending}
          aria-pressed={locale === code}
          lang={code}
          className={cn(
            'min-h-8 min-w-9 rounded-md px-2 py-1 uppercase transition-colors',
            locale === code
              ? 'bg-blue-600 text-white'
              : tone === 'dark'
                ? 'text-slate-300 hover:bg-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
