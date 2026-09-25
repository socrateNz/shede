'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { TablePagination } from './table-pagination';
import { ArrowUpRight, ArrowDownLeft, Settings2, ShoppingCart, User, Package, Coffee } from 'lucide-react';

interface Movement {
  id: string;
  created_at: string;
  item_name: string;
  item_type: 'product' | 'accompaniment';
  type: string;
  reason: string;
  quantity: number;
  users: { first_name: string; last_name: string };
}

interface StockMovementsListProps {
  movements: Movement[];
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

const REASON_KEYS = { manual_adjustment: 1, purchase: 1, loss: 1, return: 1, inventory: 1, sale: 1 } as const;

export function StockMovementsList({ movements }: StockMovementsListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const { t, format: fmt } = useT();
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
    return new Date(dateStr).toLocaleString(fmt.intl, {
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
    if (type === 'IN') return t('stock.movements.in');
    if (type === 'OUT') return reason === 'sale' ? t('stock.movements.sale') : t('stock.movements.out');
    return t('stock.movements.adjustment');
  };

  return (
    <div className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80">
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.movements.colDate')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.movements.colItem')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.movements.colItemType')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.movements.colMovement')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300 text-center">{t('stock.movements.colQuantity')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.movements.colReason')}</th>
              <th className="p-4 text-sm font-semibold text-slate-300">{t('stock.movements.colUser')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {paginatedMovements.map((m) => (
              <tr key={m.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4 text-sm text-slate-400 whitespace-nowrap">
                  {formatDate(m.created_at)}
                </td>
                <td className="p-4">
                  <div className="font-medium text-slate-200">{m.item_name}</div>
                </td>
                <td className="p-4">
                  {m.item_type === 'accompaniment' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Coffee className="w-3 h-3" />
                      {t('stock.itemType.accompaniment')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Package className="w-3 h-3" />
                      {t('stock.itemType.product')}
                    </span>
                  )}
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
                    {m.reason && m.reason in REASON_KEYS
                      ? t(`stock.reasons.${m.reason as keyof typeof REASON_KEYS}`)
                      : m.reason || t('stock.reasons.manual')}
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
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  {t('stock.movements.empty')}
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
