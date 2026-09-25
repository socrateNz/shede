'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Store } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Radix Select interdit une valeur vide : sentinelle pour « tous les points ».
const ALL_POINTS = 'all';

/**
 * Filtre par point de vente : met à jour le paramètre `point` de l'URL en
 * conservant les autres filtres (période, statut…).
 */
export function PointSelect({
  points,
  value,
  paramName = 'point',
}: {
  points: { id: string; name: string }[];
  value: string | null;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL_POINTS) params.delete(paramName);
    else params.set(paramName, next);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="point-select" className="flex items-center gap-1.5 text-sm text-slate-400">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
        Point de vente
      </label>
      <Select value={value ?? ALL_POINTS} onValueChange={handleChange}>
        <SelectTrigger id="point-select" className="w-64 border-slate-600 bg-slate-900/50 text-slate-100">
          <SelectValue placeholder="Tous les points" />
        </SelectTrigger>
        <SelectContent className="border-slate-700 bg-slate-800 text-slate-200">
          <SelectItem value={ALL_POINTS} className="focus:bg-blue-600 focus:text-white">
            Tous les points
          </SelectItem>
          {points.map((p) => (
            <SelectItem key={p.id} value={p.id} className="focus:bg-blue-600 focus:text-white">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
