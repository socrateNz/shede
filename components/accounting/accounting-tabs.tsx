'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

/** Onglets du module Comptabilité ; la période et le point choisis suivent la navigation. */
export function AccountingTabs({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useT();
  const keep = new URLSearchParams();
  for (const key of ['from', 'to', 'point']) {
    const value = searchParams.get(key);
    if (value) keep.set(key, value);
  }
  const query = keep.toString();

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label={t('accounting.header.title')}>
      {items.map((item) => {
        const active = item.href === '/accounting' ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={query ? `${item.href}?${query}` : item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
