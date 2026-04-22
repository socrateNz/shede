'use client';

import { useState } from 'react';
import { TablePagination } from './table-pagination';
import { Package, Coffee } from 'lucide-react';

interface StockItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  threshold: number;
  type: 'product' | 'accompaniment';
}

interface StockListProps {
  stocks: StockItem[];
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

export function StockList({ stocks }: StockListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'product' | 'accompaniment'>('all');
  const itemsPerPage = 10;

  const filtered = filter === 'all' ? stocks : stocks.filter((s) => s.type === filter);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedStocks = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  return (
    <div className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl overflow-hidden rounded-xl border">
      {/* Filtres */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
        {([
          { key: 'all', label: 'Tous', icon: undefined },
          { key: 'product', label: 'Produits', icon: Package },
          { key: 'accompaniment', label: 'Accompagnements', icon: Coffee },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setFilter(key); setCurrentPage(1); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              filter === key
                ? key === 'product'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : key === 'accompaniment'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-slate-600 text-slate-200 border border-slate-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
            <span className="ml-1 text-[10px] opacity-70">
              ({key === 'all' ? stocks.length : stocks.filter(s => s.type === key).length})
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80">
              <th className="p-4 text-sm font-semibold text-slate-300">Nom</th>
              <th className="p-4 text-sm font-semibold text-slate-300">Type</th>
              <th className="p-4 text-sm font-semibold text-slate-300">Catégorie</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-center">Quantité</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-center">Seuil</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-right">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {paginatedStocks.map((item) => (
              <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4">
                  <div className="font-medium text-slate-200">{item.name}</div>
                </td>
                <td className="p-4">
                  {item.type === 'product' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Package className="w-3 h-3" />
                      Produit
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Coffee className="w-3 h-3" />
                      Accompagnement
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-400">
                    {item.type === 'accompaniment' ? '—' : (item.category || 'N/A')}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <span className={cn(
                    "font-bold text-lg",
                    item.quantity <= item.threshold ? "text-amber-500" : "text-slate-50"
                  )}>
                    {item.quantity}
                  </span>
                </td>
                <td className="p-4 text-center text-slate-400 text-sm">
                  {item.threshold}
                </td>
                <td className="p-4 text-right">
                  {item.quantity <= 0 ? (
                    <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">
                      Rupture
                    </span>
                  ) : item.quantity <= item.threshold ? (
                    <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">
                      Bas
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Aucun article trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
