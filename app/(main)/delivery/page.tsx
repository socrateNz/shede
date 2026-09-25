import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Truck, MapPin, Phone, MessageCircle, Navigation, Settings2, Wallet, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { requireRole } from '@/app/actions/auth';
import { getDeliveryBoard } from '@/app/actions/delivery';
import { deliveryMapLink } from '@/lib/delivery';
import { formatCameroonPhone, whatsappLink } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { getT } from '@/lib/i18n/server';
import type { TranslationKey } from '@/lib/i18n/translate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeliveryActions } from '@/components/delivery/delivery-actions';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('delivery.meta.title'), description: t('delivery.meta.description') };
}

const DELIVERY_STATUS_CLASS: Record<string, string> = {
  TO_ASSIGN: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
  ASSIGNED: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  IN_TRANSIT: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
  DELIVERED: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  FAILED: 'border-red-500/40 text-red-300 bg-red-500/10',
};

const ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];

function courierName(order: any) {
  const c = Array.isArray(order.courier) ? order.courier[0] : order.courier;
  return c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : null;
}

export default async function DeliveryPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'LIVREUR');
  const { t, format } = await getT();
  const board = await getDeliveryBoard();
  if (!board) redirect('/unauthorized?error=module_required&module=LIVRAISON');

  const isManager = board.role === 'ADMIN' || board.role === 'MANAGER';
  const counts = {
    toAssign: board.active.filter((o: any) => o.delivery_status === 'TO_ASSIGN').length,
    inTransit: board.active.filter((o: any) => o.delivery_status === 'IN_TRANSIT').length,
    delivered: board.done.filter((o: any) => o.delivery_status === 'DELIVERED').length,
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-3">
              <Truck className="h-7 w-7 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{t('delivery.board.title')}</h1>
              <p className="text-slate-400">
                {t('delivery.board.summary', counts)}
              </p>
            </div>
          </div>
          {isManager && (
            <Link href="/delivery/zones">
              <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white">
                <Settings2 className="mr-2 h-4 w-4" />
                {t('delivery.board.zones')}
              </Button>
            </Link>
          )}
        </div>

        {/* Courses en cours */}
        {board.active.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/30 py-20 text-center">
            <Truck className="mb-4 h-14 w-14 text-slate-600" />
            <h2 className="text-xl font-bold text-slate-300">{t('delivery.board.emptyTitle')}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {t('delivery.board.emptyText')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {board.active.map((order: any) => {
              const statusKey = order.delivery_status in DELIVERY_STATUS_CLASS ? order.delivery_status : 'TO_ASSIGN';
              const status = {
                label: t(`delivery.status.${statusKey}` as TranslationKey),
                className: DELIVERY_STATUS_CLASS[statusKey],
              };
              const whatsapp = whatsappLink(order.phone);
              const isPaid = order.status === 'COMPLETED';
              const itemsCount = (order.order_items || []).reduce((n: number, i: any) => n + (Number(i.quantity) || 0), 0);
              const courier = courierName(order);

              return (
                <Card key={order.id} className="border-slate-700/50 bg-slate-800/50 shadow-xl">
                  <CardHeader className="border-b border-slate-700/50 pb-3">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span className="font-mono text-white">#{order.id.slice(-8).toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-normal text-slate-400">{ORDER_STATUSES.includes(order.status) ? t(`orders.status.${order.status}` as TranslationKey) : order.status}</span>
                        <Badge variant="outline" className={cn('text-xs', status.className)}>
                          {status.label}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {/* Adresse */}
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <MapPin className="h-4 w-4 shrink-0 text-cyan-400" />
                        {[order.delivery_district, order.delivery_city].filter(Boolean).join(', ') || order.delivery_zone_name}
                      </p>
                      {order.delivery_landmark && (
                        <p className="rounded-md bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                          {t('delivery.board.landmark', { landmark: order.delivery_landmark })}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {t('delivery.board.zoneFee', { zone: order.delivery_zone_name, fee: format.money(order.delivery_fee) })}
                      </p>
                    </div>

                    {/* Contact & itinéraire */}
                    <div className="flex flex-wrap gap-2">
                      {order.phone && (
                        <a
                          href={`tel:${order.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                        >
                          <Phone className="h-4 w-4" /> {formatCameroonPhone(order.phone)}
                        </a>
                      )}
                      {whatsapp && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                        >
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </a>
                      )}
                      <a
                        href={deliveryMapLink(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                      >
                        <Navigation className="h-4 w-4" />
                        {order.delivery_lat != null ? t('delivery.board.gps') : t('delivery.board.route')}
                      </a>
                    </div>

                    {/* Montant */}
                    <div className="flex items-center justify-between rounded-lg bg-slate-900/40 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-300">
                        <Wallet className="h-4 w-4" />
                        {t('delivery.board.items', { count: itemsCount })}
                      </span>
                      <span className={cn('font-semibold', isPaid ? 'text-emerald-300' : 'text-amber-300')}>
                        {isPaid ? t('delivery.board.paid') : t('delivery.board.toCollect', { amount: format.money(order.total) })}
                      </span>
                    </div>

                    <p className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      {t('delivery.board.orderedAt', { time: format.time(order.created_at) })}
                      {courier && <span>{t('delivery.board.courier', { name: courier })}</span>}
                    </p>

                    <DeliveryActions
                      orderId={order.id}
                      deliveryStatus={order.delivery_status}
                      courierId={order.courier_id}
                      role={board.role}
                      userId={board.userId}
                      couriers={board.couriers}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Terminées aujourd'hui */}
        {board.done.length > 0 && (
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-slate-50">{t('delivery.board.doneToday')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-700/60">
                {board.done.map((order: any) => {
                  const delivered = order.delivery_status === 'DELIVERED';
                  return (
                    <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {delivered ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className="font-mono text-slate-200">#{order.id.slice(-8).toUpperCase()}</span>
                        <span className="text-slate-400">{order.delivery_district || order.delivery_zone_name}</span>
                      </div>
                      <div className="text-right text-slate-400">
                        {delivered ? t('delivery.status.DELIVERED') : t('delivery.board.failed', { reason: order.delivery_note ?? '—' })}
                        {courierName(order) && ` · ${courierName(order)}`}
                        {order.delivered_at &&
                          ` · ${format.time(order.delivered_at)}`}
                        {delivered && order.status !== 'COMPLETED' && (
                          <span className="ml-2 text-amber-300">{t('delivery.board.collectAtRegister')}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
