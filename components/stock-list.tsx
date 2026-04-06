'use client';

import { useState } from 'react';
import { TablePagination } from './table-pagination';

interface StockItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  threshold: number;
}

interface StockListProps {
  stocks: StockItem[];
}

export function StockList({ stocks }: StockListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(stocks.length / itemsPerPage);
  const paginatedStocks = stocks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
  }

  return (
    <div className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80">
              <th className="p-4 text-sm font-semibold text-slate-300">Produit</th>
              <th className="p-4 text-sm font-semibold text-slate-300">Catégorie</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-center">Quantité</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-center">Seuil</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-right">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {paginatedStocks.map((item) => (
              <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4">
                  <div className="font-medium text-slate-200">{item.name}</div>
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-400">{item.category || 'N/A'}</span>
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
            {stocks.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Aucun produit trouvé.
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
