'use client';

import { Order } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Eye, ChevronDown, CheckCircle, XCircle, Clock, Package, Coffee, CreditCard, Ban, Smartphone, QrCode, CreditCard as CardIcon, Printer, Tag, Wallet } from 'lucide-react';
import Link from 'next/link';
import { PrintOrderButton } from './print-order-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n/client';

interface OrdersListProps {
  orders: Order[];
  canManageStatus?: boolean;
  onStatusChange?: (orderId: string, status: string) => Promise<void> | void;
  updatingOrderId?: string | null;
}

type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';

const statusStyles: Record<OrderStatus, { bg: string; text: string; icon: any }> = {
  PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Clock },
  IN_PROGRESS: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Package },
  READY: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: Coffee },
  SERVED: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: CheckCircle },
  COMPLETED: { bg: 'bg-green-500/10', text: 'text-green-400', icon: CreditCard },
  CANCELLED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: Ban },
};

const STATUS_VALUES = Object.keys(statusStyles) as OrderStatus[];

type OrderSource = 'CLIENT' | 'QR_CODE' | 'CAISSE';

const sourceStyles: Record<OrderSource, { icon: any; color: string }> = {
  CLIENT: { icon: Smartphone, color: 'text-green-400 bg-green-500/10' },
  QR_CODE: { icon: QrCode, color: 'text-purple-400 bg-purple-500/10' },
  CAISSE: { icon: CardIcon, color: 'text-blue-400 bg-blue-500/10' },
};

// Toute commande encore active n'est pas encaissée (le paiement la passe en COMPLETED).
const isAwaitingPayment = (status: string) => !['COMPLETED', 'CANCELLED'].includes(status);

const getValidNextStatuses = (currentStatus: string) => {
  switch (currentStatus) {
    case 'PENDING':
      return ['IN_PROGRESS', 'CANCELLED'];
    case 'IN_PROGRESS':
      return ['READY', 'CANCELLED'];
    case 'READY':
      return ['SERVED'];
    case 'SERVED':
      return ['COMPLETED'];
    case 'COMPLETED':
    case 'CANCELLED':
    default:
      return []; // No further transitions allowed
  }
};

export function OrdersList({
  orders,
  canManageStatus = false,
  onStatusChange,
  updatingOrderId = null,
}: OrdersListProps) {
  const { t, format } = useT();

  const statusColors = Object.fromEntries(
    STATUS_VALUES.map((value) => [value, { ...statusStyles[value], label: t(`orders.status.${value}`) }])
  ) as Record<string, { bg: string; text: string; icon: any; label: string }>;

  const statusOptions = STATUS_VALUES.map((value) => ({
    value,
    label: t(`orders.status.${value}`),
    icon: statusStyles[value].icon,
    color: statusStyles[value].text,
  }));

  const getSourceConfig = (source: string) => {
    const key: OrderSource = source in sourceStyles ? (source as OrderSource) : 'CAISSE';
    return { ...sourceStyles[key], label: t(`orders.source.${key}`) };
  };

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800/50">
              <TableHead className="text-slate-300 font-semibold">{t('orders.list.colNumber')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('orders.list.colSource')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('orders.list.colPlace')}</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">{t('orders.list.colTotal')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('orders.list.colStatus')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('orders.list.colTime')}</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">{t('orders.list.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const statusColor = statusColors[order.status] || statusColors.PENDING;
              const StatusIcon = statusColor.icon;
              const source = getSourceConfig(order.source || 'CAISSE');
              const SourceIcon = source.icon;
              const validNextStatuses = getValidNextStatuses(order.status);
              const isStatusDisabled = updatingOrderId === order.id || validNextStatuses.length === 0;

              return (
                <TableRow
                  key={order.id}
                  className="border-slate-700 hover:bg-slate-800/50 transition-colors group"
                >
                  <TableCell className="text-slate-50 font-mono text-sm font-medium">
                    #{order.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${source.color}`}>
                        <SourceIcon className="w-3.5 h-3.5" />
                        {source.label}
                      </span>
                      {order.phone && (
                        <span className="text-xs text-slate-500">📞 {order.phone}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {(order as any).rooms?.number ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {t('orders.list.room', { number: (order as any).rooms.number })}
                      </span>
                    ) : order.table_number ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                        {t('orders.list.table', { number: order.table_number })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        {(order as any).consumption_type === 'DELIVERY' ? t('orders.list.delivery') : t('orders.list.takeaway')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-50 text-right font-bold">
                    <div className="flex flex-col items-end">
                      {format.money(order.total)}
                      {(order as any).discount_amount > 0 && (
                        <span className="text-[10px] text-pink-400 font-bold bg-pink-500/10 px-1.5 py-0.5 rounded-sm mt-1 inline-flex items-center gap-1 border border-pink-500/20">
                          <Tag className="w-3 h-3" /> {t('orders.list.promo')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      {canManageStatus ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isStatusDisabled}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text} ${!isStatusDisabled ? 'hover:' + statusColor.bg + ' cursor-pointer' : 'opacity-80 cursor-not-allowed'}`}
                            >
                              {updatingOrderId === order.id ? (
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusColor.label}
                                  {validNextStatuses.length > 0 && <ChevronDown className="w-3 h-3 ml-1 opacity-70" />}
                                </>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-48 bg-slate-800 border-slate-700 text-slate-200"
                          >
                            {statusOptions
                              .filter(option => validNextStatuses.includes(option.value))
                              .map((option) => {
                                const OptionIcon = option.icon;
                                return (
                                  <DropdownMenuItem
                                    key={option.value}
                                    onClick={() => onStatusChange?.(order.id, option.value)}
                                    className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2"
                                  >
                                    <OptionIcon className={`w-4 h-4 ${option.color}`} />
                                    <span>{option.label}</span>
                                  </DropdownMenuItem>
                                );
                              })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusColor.label}
                        </span>
                      )}
                      {isAwaitingPayment(order.status) && (
                        <Link
                          href={`/orders/${order.id}`}
                          title={t('orders.list.awaitingPaymentHint')}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
                        >
                          <Wallet className="h-3 w-3" aria-hidden />
                          {t('orders.list.awaitingPayment')}
                        </Link>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    {format.time(order.created_at)}
                    <span className="text-xs text-slate-500 block">
                      {format.date(order.created_at)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {order.status === 'COMPLETED' && (
                        <PrintOrderButton order={order} variant="button" />
                      )}
                      <Link href={`/orders/${order.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200"
                          title={t('orders.list.viewDetails')}
                          aria-label={t('orders.list.viewDetails')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}