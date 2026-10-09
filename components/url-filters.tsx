'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Met à jour un paramètre d'URL (vide = retiré) et revient à la page 1. */
function useUrlParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { value: (key: string) => searchParams.get(key) ?? '', set, pending };
}

const field = 'h-10 rounded-lg border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

/** Recherche serveur : écrit ?q= après une courte pause de frappe. */
export function UrlSearch({ placeholder, param = 'q', className }: { placeholder: string; param?: string; className?: string }) {
  const url = useUrlParam();
  const [text, setText] = useState(url.value(param));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => url.set(param, text.trim() || null), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(field, 'w-full pl-9 pr-9')}
      />
      {url.pending && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden />}
    </div>
  );
}

/** Filtre serveur par liste déroulante : la première option (valeur vide) = tous. */
export function UrlSelect({ param, label, options, className }: { param: string; label: string; options: { value: string; label: string }[]; className?: string }) {
  const url = useUrlParam();
  return (
    <select value={url.value(param)} onChange={(e) => url.set(param, e.target.value || null)} aria-label={label} className={cn(field, className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
