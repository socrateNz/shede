'use client';

import { Order } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Eye, ChevronDown, CheckCircle, XCircle, Clock, Package, Coffee, CreditCard, Ban, Smartphone, QrCode, CreditCard as CardIcon, Printer } from 'lucide-react';
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

interface OrdersListProps {
  orders: Order[];
  canManageStatus?: boolean;
  onStatusChange?: (orderId: string, status: string) => Promise<void> | void;
  updatingOrderId?: string | null;
}

const statusColors: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Clock, label: 'En attente' },
  IN_PROGRESS: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Package, label: 'En préparation' },
  READY: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: Coffee, label: 'Prête' },
  SERVED: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: CheckCircle, label: 'Servie' },
  COMPLETED: { bg: 'bg-green-500/10', text: 'text-green-400', icon: CreditCard, label: 'Payée' },
  CANCELLED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: Ban, label: 'Annulée' },
};

const statusOptions = [
  { value: 'PENDING', label: 'En attente', icon: Clock, color: 'text-yellow-400' },
  { value: 'IN_PROGRESS', label: 'En préparation', icon: Package, color: 'text-blue-400' },
  { value: 'READY', label: 'Prête', icon: Coffee, color: 'text-purple-400' },
  { value: 'SERVED', label: 'Servie', icon: CheckCircle, color: 'text-cyan-400' },
  { value: 'COMPLETED', label: 'Payée', icon: CreditCard, color: 'text-green-400' },
  { value: 'CANCELLED', label: 'Annulée', icon: Ban, color: 'text-red-400' },
];

const sourceConfig: Record<string, { icon: any; label: string; color: string }> = {
  CLIENT: { icon: Smartphone, label: 'Application', color: 'text-green-400 bg-green-500/10' },
  QR_CODE: { icon: QrCode, label: 'QR Code', color: 'text-purple-400 bg-purple-500/10' },
  CAISSE: { icon: CardIcon, label: 'Caisse', color: 'text-blue-400 bg-blue-500/10' },
};

export function OrdersList({
  orders,
  canManageStatus = false,
  onStatusChange,
  updatingOrderId = null,
}: OrdersListProps) {
  const getSourceConfig = (source: string) => {
    return sourceConfig[source] || sourceConfig.CAISSE;
  };

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800/50">
            <TableHead className="text-slate-300 font-semibold">N° commande</TableHead>
            <TableHead className="text-slate-300 font-semibold">Source</TableHead>
            <TableHead className="text-slate-300 font-semibold">Table / Chambre</TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">Total</TableHead>
            <TableHead className="text-slate-300 font-semibold">Statut</TableHead>
            <TableHead className="text-slate-300 font-semibold">Heure</TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const statusColor = statusColors[order.status] || statusColors.PENDING;
            const StatusIcon = statusColor.icon;
            const source = getSourceConfig(order.source || 'CAISSE');
            const SourceIcon = source.icon;

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
                      🛏️ Chambre {(order as any).rooms.number}
                    </span>
                  ) : order.table_number ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                      🍽️ Table {order.table_number}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      📦 À emporter
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-slate-50 text-right font-bold">
                  {order.total.toLocaleString()} FCFA
                </TableCell>
                <TableCell>
                  {canManageStatus ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updatingOrderId === order.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text} hover:${statusColor.bg} cursor-pointer`}
                        >
                          {updatingOrderId === order.id ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <StatusIcon className="w-3 h-3" />
                              {statusColor.label}
                              <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-48 bg-slate-800 border-slate-700 text-slate-200"
                      >
                        {statusOptions.map((option) => {
                          const OptionIcon = option.icon;
                          return (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() => onStatusChange?.(order.id, option.value)}
                              className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2"
                            >
                              <OptionIcon className={`w-4 h-4 ${option.color}`} />
                              <span>{option.label}</span>
                              {order.status === option.value && (
                                <CheckCircle className="w-3 h-3 ml-auto text-green-400" />
                              )}
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
                </TableCell>
                <TableCell className="text-slate-400 text-sm">
                  {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  <span className="text-xs text-slate-500 block">
                    {new Date(order.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {order.status === 'COMPLETED' && (
                      <PrintOrderButton order={order} />
                    )}
                    <Link href={`/orders/${order.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200"
                        title="Voir les détails"
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
  );
}