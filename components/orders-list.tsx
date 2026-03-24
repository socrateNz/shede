'use client';

import { Order } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface OrdersListProps {
  orders: Order[];
  canManageStatus?: boolean;
  onStatusChange?: (orderId: string, status: string) => Promise<void> | void;
  updatingOrderId?: string | null;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  IN_PROGRESS: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  READY: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  SERVED: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  COMPLETED: { bg: 'bg-green-500/10', text: 'text-green-400' },
  CANCELLED: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

export function OrdersList({
  orders,
  canManageStatus = false,
  onStatusChange,
  updatingOrderId = null,
}: OrdersListProps) {
  const statusOptions = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-700 hover:bg-slate-800">
          <TableHead className="text-slate-300">Order ID</TableHead>
          <TableHead className="text-slate-300">Table</TableHead>
          <TableHead className="text-slate-300 text-right">Total</TableHead>
          <TableHead className="text-slate-300">Status</TableHead>
          <TableHead className="text-slate-300">Time</TableHead>
          <TableHead className="text-slate-300 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const statusColor = statusColors[order.status] || statusColors.PENDING;
          return (
            <TableRow key={order.id} className="border-slate-700 hover:bg-slate-700/50">
              <TableCell className="text-slate-50 font-mono text-sm">{order.id.slice(0, 8)}</TableCell>
              <TableCell className="text-slate-400">{order.table_number ? `Table ${order.table_number}` : '-'}</TableCell>
              <TableCell className="text-slate-50 text-right font-medium">${order.total.toFixed(2)}</TableCell>
              <TableCell>
                {canManageStatus ? (
                  <select
                    value={order.status}
                    disabled={updatingOrderId === order.id}
                    onChange={(e) => onStatusChange?.(order.id, e.target.value)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-slate-600 bg-slate-800 ${statusColor.text}`}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                  >
                    {order.status}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-slate-400 text-sm">
                {new Date(order.created_at).toISOString().slice(0, 16).replace('T', ' ')}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/orders/${order.id}`}>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
                    <Eye className="w-4 h-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
