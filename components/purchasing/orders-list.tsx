'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PurchaseOrderListStats, PurchaseOrderSummary } from '@/app/actions/purchasing';
import type { Paginated } from '@/lib/pagination';
import { PageNav } from '@/components/page-nav';
import { UrlSearch, UrlSelect } from '@/components/url-filters';
import { useT } from '@/lib/i18n/client';

export const ORDER_STATUS_STYLES = {
  DRAFT: 'bg-slate-700/50 text-slate-300',
  SENT: 'bg-sky-500/10 text-sky-300',
  PARTIAL: 'bg-amber-500/10 text-amber-300',
  RECEIVED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-red-500/10 text-red-300',
} as const;

/** Liste des bons de commande : une page de 20, filtrée par le serveur ; null = module non installé. */
export function PurchaseOrdersList({ result, canManage }: { result: Paginated<PurchaseOrderSummary, PurchaseOrderListStats> | null; canManage: boolean }) {
  const { t, format } = useT();
  const orders = result?.items ?? null;
  const stats = result?.meta.stats;
  const statuses = Object.keys(ORDER_STATUS_STYLES) as (keyof typeof ORDER_STATUS_STYLES)[];
  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('purchasing.orders.title')}</h1>
          <p className="max-w-2xl text-slate-400">{t('purchasing.orders.subtitle')}</p>
        </div>
        {orders !== null && canManage && (
          <Link href="/purchasing/orders/new">
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700">
              <Plus className="mr-2 h-4 w-4" /> {t('purchasing.orders.newButton')}
            </Button>
          </Link>
        )}
      </div>

      {orders === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('purchasing.notInstalled')}</p>
      ) : (
        <>
        {stats && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3">
              <div className="text-xs text-slate-400">{t('purchasing.orders.statTotal')}</div>
              <div className="text-xl font-bold text-white">{format.number(stats.total.count)}</div>
              <div className="text-xs tabular-nums text-cyan-300">{format.money(stats.total.amount)}</div>
            </div>
            {statuses.map((st) => (
              <div key={st} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3">
                <div className="text-xs text-slate-400">{t(`purchasing.orders.status.${st}`)}</div>
                <div className="text-xl font-bold text-white">{format.number(stats.byStatus[st]?.count ?? 0)}</div>
                <div className="text-xs tabular-nums text-slate-400">{format.money(stats.byStatus[st]?.amount ?? 0)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/50 p-3">
            <UrlSearch placeholder={t('purchasing.orders.search')} className="min-w-48 flex-1" />
            <UrlSelect
              param="status"
              label={t('purchasing.orders.allStatuses')}
              options={[{ value: '', label: t('purchasing.orders.allStatuses') }, ...statuses.map((st) => ({ value: st, label: t(`purchasing.orders.status.${st}`) }))]}
            />
          </div>
          {orders.length === 0 ? (
            <p className="py-14 text-center text-sm text-slate-400">{t('purchasing.orders.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.orders.colNumber')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.orders.colSupplier')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.orders.colStatus')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.orders.colExpected')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.orders.colTotal')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.orders.colDate')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.orders.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="font-mono text-sm text-slate-100">{order.number}</TableCell>
                    <TableCell className="text-slate-200">{order.supplier_name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}>
                        {t(`purchasing.orders.status.${order.status}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-300">{order.expected_date ? format.date(order.expected_date) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-100">{format.money(order.total_ht)}</TableCell>
                    <TableCell className="text-sm text-slate-400">{format.date(order.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/purchasing/orders/${order.id}`}>
                        <Button size="sm" variant="ghost" className="text-cyan-300 hover:bg-slate-700">{t('purchasing.orders.open')}</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {result && <PageNav meta={result.meta} />}
        </div>
        </>
      )}
    </div>
  );
}
