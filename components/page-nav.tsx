'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import type { PageMeta } from '@/lib/pagination';

/** Pages visibles autour de la page courante : 1 … 4 5 [6] 7 8 … 20 */
function visiblePages(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

/**
 * Pagination par l'URL (?page=N) : garde les autres paramètres (recherche, filtres),
 * pour que la page reste partageable et que le serveur ne charge que 20 lignes.
 */
export function PageNav({
  meta,
  param = 'page',
  tone = 'dark',
  className,
}: {
  meta: Pick<PageMeta<unknown>, 'page' | 'pageSize' | 'total' | 'totalPages'>;
  param?: string;
  /** dark : back-office ; light : espace client sur fond clair. */
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const { t, format } = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { page, pageSize, total, totalPages } = meta;
  if (total === 0) return null;

  const href = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete(param);
    else params.set(param, String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const base = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors';
  const dark = tone === 'dark';
  const idle = dark ? 'text-slate-300 hover:bg-slate-700/60 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  const off = dark ? 'text-slate-600' : 'text-slate-300';

  return (
    <nav aria-label={t('common.pagination.label')} className={cn('flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row', dark ? 'border-slate-700/50 bg-slate-800/10' : 'border-slate-200', className)}>
      {page > totalPages ? (
        // Numéro de page trop grand (lien ancien, éléments supprimés) : retour à la dernière page.
        <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
          {t('common.pagination.beyond')}{' '}
          <Link href={href(totalPages)} scroll={false} className="font-medium text-blue-400 underline-offset-2 hover:underline">
            {t('common.pagination.lastPage', { page: format.number(totalPages) })}
          </Link>
        </p>
      ) : (
        <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
          {t('common.pagination.range', { from: format.number(from), to: format.number(to), total: format.number(total) })}
        </p>
      )}
      {totalPages > 1 && page <= totalPages && (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label={t('common.pagination.previousAria')} className={cn(base, idle)} scroll={false}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span aria-hidden className={cn(base, off)}><ChevronLeft className="h-4 w-4" /></span>
          )}
          {visiblePages(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className={cn('px-1', dark ? 'text-slate-500' : 'text-slate-400')}>…</span>
            ) : (
              <Link
                key={p}
                href={href(p)}
                scroll={false}
                aria-current={p === page ? 'page' : undefined}
                className={cn(base, p === page ? 'bg-blue-600 text-white' : idle)}
              >
                {format.number(p)}
              </Link>
            ),
          )}
          {page < totalPages ? (
            <Link href={href(page + 1)} aria-label={t('common.pagination.nextAria')} className={cn(base, idle)} scroll={false}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span aria-hidden className={cn(base, off)}><ChevronRight className="h-4 w-4" /></span>
          )}
        </div>
      )}
    </nav>
  );
}
