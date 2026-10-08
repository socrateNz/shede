'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail, MessageCircle, PackageCheck, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cancelPurchaseOrder, sendPurchaseOrder, type PurchaseOrderDetail } from '@/app/actions/purchasing';
import { ORDER_STATUS_STYLES } from '@/components/purchasing/orders-list';
import { whatsappLink } from '@/lib/purchasing';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';

/** Fiche d'un bon de commande : lignes, envoi, réceptions, annulation. */
export function PurchaseOrderDetailView({ order, pointName }: { order: PurchaseOrderDetail; pointName: string }) {
  const { t, format } = useT();
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canSend = order.canManage && (order.status === 'DRAFT' || order.status === 'SENT');
  const canReceive = ['DRAFT', 'SENT', 'PARTIAL'].includes(order.status);
  const unitShort = (unit: string | null) => (unit ? t(`ingredients.unitShort.${unit as 'kg' | 'l' | 'piece'}`) : t('purchasing.catalog.unitProduct'));

  function sendEmail() {
    startTransition(async () => {
      const result = await sendPurchaseOrder(order.id, 'email');
      if (!result.success) toast.error(result.error);
      else {
        toast.success(t('purchasing.orders.sentEmail'));
        router.refresh();
      }
    });
  }

  function sendWhatsapp() {
    if (!order.supplier?.phone) {
      toast.error(t('purchasing.orders.noPhone'));
      return;
    }
    const text = [
      t('purchasing.orders.whatsappHeader', { number: order.number, point: pointName }),
      '',
      ...order.lines.map((l) => t('purchasing.orders.whatsappLine', { quantity: format.number(l.quantity), pack: l.pack_label, item: l.label })),
      '',
      ...(order.expected_date ? [t('purchasing.orders.whatsappExpected', { date: format.date(order.expected_date) })] : []),
      t('purchasing.orders.whatsappTotal', { amount: format.money(order.total_ht) }),
      ...(order.note ? ['', order.note] : []),
    ].join('\n');
    // Ouvert tout de suite (geste de l'utilisateur), puis la commande est marquée « envoyée ».
    window.open(whatsappLink(order.supplier.phone, text), '_blank', 'noopener');
    startTransition(async () => {
      const result = await sendPurchaseOrder(order.id, 'whatsapp');
      if (!result.success) toast.error(result.error);
      else {
        toast.success(t('purchasing.orders.markedSent'));
        router.refresh();
      }
    });
  }

  async function cancel() {
    if (!(await dialogs.confirm({ description: t('purchasing.orders.cancelConfirm'), destructive: true }))) return;
    startTransition(async () => {
      const result = await cancelPurchaseOrder(order.id);
      if (!result.success) toast.error(result.error);
      else {
        toast.success(t('purchasing.orders.cancelled'));
        router.refresh();
      }
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <Link href="/purchasing/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300">
        <ArrowLeft className="h-4 w-4" /> {t('purchasing.orders.back')}
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-bold text-white">{order.number}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}>
              {t(`purchasing.orders.status.${order.status}`)}
            </span>
          </div>
          <p className="mt-1 text-slate-300">
            <Link href={`/purchasing/suppliers/${order.supplier_id}`} className="hover:text-cyan-300">{order.supplier_name}</Link>
            {order.expected_date && <> · {t('purchasing.orders.expectedDate')} : {format.date(order.expected_date)}</>}
          </p>
          {order.sent_at && <p className="text-xs text-slate-500">{t('purchasing.orders.sentOn', { date: format.dateTime(order.sent_at) })}</p>}
          {order.note && <p className="mt-2 text-sm italic text-slate-400">{order.note}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {order.canManage && order.status === 'DRAFT' && (
            <Link href={`/purchasing/orders/${order.id}/edit`}>
              <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                <Pencil className="mr-2 h-4 w-4" /> {t('purchasing.orders.edit')}
              </Button>
            </Link>
          )}
          {canSend && (
            <>
              <Button type="button" variant="outline" onClick={sendEmail} disabled={pending || !order.supplier?.email} title={order.supplier?.email ?? ''} className="border-slate-600 text-slate-200 hover:bg-slate-700">
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {t('purchasing.orders.sendEmail')}
              </Button>
              <Button type="button" variant="outline" onClick={sendWhatsapp} disabled={pending} className="border-green-700/60 text-green-300 hover:bg-green-900/30">
                <MessageCircle className="mr-2 h-4 w-4" /> {t('purchasing.orders.sendWhatsapp')}
              </Button>
            </>
          )}
          {canReceive && (
            <Link href={`/purchasing/orders/${order.id}/receive`}>
              <Button className="bg-cyan-600 text-white hover:bg-cyan-700">
                <PackageCheck className="mr-2 h-4 w-4" /> {t('purchasing.orders.receive')}
              </Button>
            </Link>
          )}
          {canSend && (
            <Button type="button" variant="ghost" onClick={cancel} disabled={pending} className="text-red-300 hover:bg-red-500/10">
              <X className="mr-1.5 h-4 w-4" /> {t('purchasing.orders.cancel')}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
              <TableHead className="font-semibold text-slate-300">{t('purchasing.orders.colItem')}</TableHead>
              <TableHead className="font-semibold text-slate-300">{t('purchasing.orders.colPack')}</TableHead>
              <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.orders.ordered')}</TableHead>
              <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.orders.received')}</TableHead>
              <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.orders.colPrice')}</TableHead>
              <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.orders.colLineTotal')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lines.map((line) => {
              const complete = line.received_quantity >= line.quantity;
              return (
                <TableRow key={line.id} className="border-slate-700">
                  <TableCell className="font-medium text-slate-100">{line.label}</TableCell>
                  <TableCell className="text-sm text-slate-300">
                    {line.pack_label}
                    <p className="text-xs text-slate-500">{format.number(line.pack_size, { maximumFractionDigits: 3 })} {unitShort(line.unit)}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-200">{format.number(line.quantity)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${complete ? 'text-green-400' : line.received_quantity > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                    {format.number(line.received_quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-200">{format.money(line.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-100">{format.money(Math.round(line.quantity * line.unit_price))}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="border-slate-700 bg-slate-800/60">
              <TableCell colSpan={5} className="text-right font-semibold text-slate-300">{t('purchasing.orders.total')}</TableCell>
              <TableCell className="text-right font-bold tabular-nums text-white">{format.money(order.total_ht)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-white">{t('purchasing.orders.receipts')}</h2>
      {order.receipts.length === 0 ? (
        <p className="text-sm text-slate-400">{t('purchasing.orders.noReceipts')}</p>
      ) : (
        <ul className="space-y-2">
          {order.receipts.map((receipt) => (
            <li key={receipt.id} className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 text-sm">
              <span className="font-mono text-slate-100">{receipt.number}</span>
              <span className="text-slate-400">{format.dateTime(receipt.received_at)}</span>
              <span className="tabular-nums text-slate-100">{format.money(receipt.total_ht)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
