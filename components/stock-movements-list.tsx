'use client';

import { useState } from 'react';
import { TablePagination } from './table-pagination';
import { ArrowUpRight, ArrowDownLeft, Settings2, ShoppingCart, User } from 'lucide-react';

interface Movement {
  id: string;
  created_at: string;
  products: { name: string };
  type: string;
  reason: string;
  quantity: number;
  users: { first_name: string; last_name: string };
}

interface StockMovementsListProps {
  movements: Movement[];
}

export function StockMovementsList({ movements }: StockMovementsListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(movements.length / itemsPerPage);
  const paginatedMovements = movements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIcon = (type: string, reason: string) => {
    if (type === 'IN') return <ArrowUpRight className="w-4 h-4 text-emerald-500" />;
    if (type === 'OUT') {
      if (reason === 'sale') return <ShoppingCart className="w-4 h-4 text-blue-500" />;
      return <ArrowDownLeft className="w-4 h-4 text-red-500" />;
    }
    return <Settings2 className="w-4 h-4 text-amber-500" />;
  };

  const getLabel = (type: string, reason: string) => {
    if (type === 'IN') return 'Entrée';
    if (type === 'OUT') return reason === 'sale' ? 'Vente' : 'Sortie';
    return 'Ajustement';
  };

  function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
  }

  return (
    <div className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80">
              <th className="p-4 text-sm font-semibold text-slate-300">Date</th>
              <th className="p-4 text-sm font-semibold text-slate-300">Produit</th>
              <th className="p-4 text-sm font-semibold text-slate-300">Type</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-center">Quantité</th>
              <th className="p-4 text-sm font-semibold text-slate-300">Raison</th>
              <th className="p-4 text-sm font-semibold text-slate-300">Utilisateur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {paginatedMovements.map((m) => (
              <tr key={m.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4 text-sm text-slate-400 whitespace-nowrap">
                  {formatDate(m.created_at)}
                </td>
                <td className="p-4">
                  <div className="font-medium text-slate-200">{m.products?.name}</div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-slate-700/50">
                      {getIcon(m.type, m.reason)}
                    </div>
                    <span className="text-sm font-medium text-slate-300">{getLabel(m.type, m.reason)}</span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className={cn(
                    "font-bold",
                    m.type === 'IN' ? "text-emerald-500" : m.type === 'OUT' ? "text-red-500" : "text-amber-500"
                  )}>
                    {m.type === 'OUT' ? '-' : m.type === 'IN' ? '+' : ''}{m.quantity}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-400 italic">
                    {m.reason === 'purchase' ? 'Achat' :
                      m.reason === 'sale' ? 'Vente POS' :
                        m.reason === 'loss' ? 'Perte / Casse' :
                          m.reason || 'Saisie manuelle'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <User className="w-3.5 h-3.5" />
                    {m.users?.first_name} {m.users?.last_name}
                  </div>
                </td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Aucun mouvement enregistré.
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
