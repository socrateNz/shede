'use client';

import { useEffect, useState, type Ref } from 'react';
import { getShiftReport } from '@/app/actions/shifts';
import { useT } from '@/lib/i18n/client';
import { moduleLabel } from '@/lib/modules';
import type { Translator } from '@/lib/i18n/translate';
import {
  Receipt,
  Calendar,
  User,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  ChefHat,
  Hotel,
  AlertCircle,
  Building2,
  Clock,
  Smartphone,
  Beer,
  Bike,
  LayoutGrid,
  Package,
  Tag,
  Users,
  Contact,
  LucideIcon,
} from 'lucide-react';

interface Props {
  shiftId: string;
  containerRef?: Ref<HTMLDivElement>;
}

const RESTAURANT_MODULES = ['POS', 'CUISINE', 'BAR', 'TABLES', 'LIVRAISON', 'CLIENT_APP'];

const MODULE_ICONS: Record<string, LucideIcon> = {
  POS: Wallet,
  CLIENT_APP: Smartphone,
  CUISINE: ChefHat,
  BAR: Beer,
  LIVRAISON: Bike,
  TABLES: LayoutGrid,
  HOTEL: Hotel,
  STOCK: Package,
  PROMOTION: Tag,
  RH: Users,
  CRM: Contact,
};

function getModuleMetric(
  t: Translator,
  formatFCFA: (value: number) => string,
  moduleKey: string,
  summary: any
): { value: string; note: string } | null {
  if (moduleKey === 'POS') {
    return { value: formatFCFA(summary.orderRevenue), note: t('documents.zReport.ordersPaid', { count: summary.orderCount }) };
  }
  if (moduleKey === 'HOTEL') {
    return { value: formatFCFA(summary.bookingRevenue), note: t('documents.zReport.bookingsPaid', { count: summary.bookingCount }) };
  }
  if (moduleKey === 'PROMOTION') {
    return { value: `-${formatFCFA(summary.totalDiscounts)}`, note: t('documents.zReport.discountsTotal') };
  }
  return null;
}

const PAYMENT_KEYS = { CASH: 1, CARD: 1, CHEQUE: 1, TRANSFER: 1, MOBILE: 1, AUTRE: 1 } as const;

export function RapportZ({ shiftId, containerRef }: Props) {
  const [data, setData] = useState<any>(null);
  const { t, format } = useT();
  const formatFCFA = (value: number) => format.money(value);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getShiftReport(shiftId);
      setData(res);
      setLoading(false);
    }
    load();
  }, [shiftId]);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p>{t('documents.zReport.loading')}</p>
      </div>
    );
  }

  if (!data?.shift) return <div>{t('documents.zReport.loadError')}</div>;

  const { shift, orders, bookings, paymentMethods, modules, summary } = data;
  const isPositiveEcart = Number(summary.difference) > 0;
  const isNegativeEcart = Number(summary.difference) < 0;
  const showRestaurantSection = modules.some((m: string) => RESTAURANT_MODULES.includes(m));
  const showHotelSection = modules.includes('HOTEL');
  // A Rapport Z is a cash reconciliation document — only modules that move money
  // during the shift belong here. Operational modules (KDS, Bar display, Stock,
  // RH, CRM...) have nothing to reconcile and are omitted, not just greyed out.
  const financialModules = modules
    .map((m: string) => ({ key: m, info: { label: moduleLabel(t, m), icon: MODULE_ICONS[m] ?? Package }, metric: getModuleMetric(t, formatFCFA, m, summary) }))
    .filter((m: { metric: { value: string; note: string } | null }) => m.metric !== null);

  return (
    <div className="bg-slate-100/50 p-4 min-h-screen print:p-0 print:bg-white transition-all duration-300">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 15mm;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
           @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <div
        id="print-area"
        ref={containerRef}
        className="mx-auto bg-white shadow-2xl rounded-none w-full max-w-[210mm] min-h-[297mm] p-[10mm] md:p-[20mm] text-slate-900 border border-slate-200 print:border-0"
      >
        {/* Company Header */}
        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-lg font-black text-2xl">
                {shift.structures?.name?.charAt(0) || 'S'}
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{shift.structures?.name}</h1>
                <p className="text-slate-500 font-bold tracking-widest text-xs mt-1">{t('documents.zReport.establishment', { name: shift.structures?.name?.toUpperCase() ?? '' })}</p>
              </div>
            </div>
            <div className="text-sm space-y-1 text-slate-600 font-medium">
              <p className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {shift.structures?.address || t('documents.zReport.noAddress')}</p>
              <p className="flex items-center gap-2"><Wallet className="w-4 h-4" /> {t('documents.zReport.phone', { phone: shift.structures?.phone || 'N/A' })}</p>
              {(shift.structures?.niu || shift.structures?.rccm) && (
                <p className="flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  {[shift.structures?.niu && t('documents.identity.niu', { niu: shift.structures.niu }), shift.structures?.rccm && t('documents.identity.rccm', { rccm: shift.structures.rccm })]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-slate-900 text-white px-4 py-2 font-black text-xl mb-2">{t('documents.zReport.title')}</div>
            <p className="text-xs font-bold text-slate-400">{t('documents.zReport.session', { id: shift.id.slice(0, 8).toUpperCase() })}</p>
            <p className="text-xs font-bold text-slate-400 mt-1">{format.date(new Date())}</p>
          </div>
        </div>

        {/* Audit Details */}
        <div className="grid grid-cols-2 gap-16 mb-10">
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-l-4 border-blue-500 pl-3">{t('documents.zReport.manager')}</h3>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.cashier')}</span>
                <span className="font-bold truncate">{shift.users?.first_name} {shift.users?.last_name}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.opening')}</span>
                <span className="font-bold">{format.dateTime(shift.opened_at)}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.closing')}</span>
                <span className="font-bold">{shift.closed_at ? format.dateTime(shift.closed_at) : t('documents.zReport.notClosed')}</span>
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-l-4 border-green-500 pl-3">{t('documents.zReport.flows')}</h3>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.float')}</span>
                <span className="font-bold text-blue-600">{formatFCFA(summary.openingBalance)}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.grossSales')}</span>
                <span className="font-bold text-slate-700">{formatFCFA(summary.grossSales)}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.discounts')}</span>
                <span className="font-bold text-red-500">-{formatFCFA(summary.totalDiscounts)}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.netSales')}</span>
                <span className="font-bold text-green-600">{formatFCFA(summary.netSales)}</span>
              </p>
              {Number(summary.totalTax) > 0 && (
                <p className="flex justify-between items-center border-b pb-1">
                  <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.vatCollected')}</span>
                  <span className="font-bold text-slate-700">{formatFCFA(summary.totalTax)}</span>
                </p>
              )}
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">{t('documents.zReport.expected')}</span>
                <span className="font-bold underline">{formatFCFA(summary.expectedAmount)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* The Big Number: Difference */}
        <div className={`p-6 mb-10 rounded-none border-2 border-slate-900 flex justify-between items-center ${isNegativeEcart ? 'bg-red-50' : 'bg-green-50'}`}>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">{t('documents.zReport.counted')}</h2>
            <p className="text-4xl font-black text-slate-900 mt-1">{formatFCFA(summary.actualAmount)}</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 opacity-60">{t('documents.zReport.difference')}</h2>
            <p className={`text-4xl font-black ${isNegativeEcart ? 'text-red-600' : isPositiveEcart ? 'text-green-600' : 'text-blue-600'}`}>
              {summary.difference > 0 ? '+' : ''}{formatFCFA(summary.difference)}
            </p>
          </div>
        </div>

        {/* FINANCIAL BREAKDOWN BY MODULE */}
        {financialModules.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 bg-slate-100 p-2 border-l-4 border-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> {t('documents.zReport.byModule')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {financialModules.map(({ key, info, metric }: { key: string; info: { label: string; icon: LucideIcon }; metric: { value: string; note: string } }) => {
              const Icon = info.icon;
              return (
                <div key={key} className="bg-slate-50 border border-slate-200 p-3 flex items-start gap-2">
                  <Icon className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500 truncate">{info.label}</p>
                    <p className="text-sm font-black text-slate-900">{metric.value}</p>
                    <p className="text-[9px] text-slate-400">{metric.note}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* DETAILED LOGS: RESTAURANT */}
        {showRestaurantSection && (
        <div className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 bg-slate-100 p-2 border-l-4 border-orange-500 flex items-center gap-2">
            <ChefHat className="w-4 h-4" /> {t('documents.zReport.restaurantTitle')}
          </h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase text-slate-500">
                <th className="py-2">{t('documents.zReport.ref')}</th>
                <th className="py-2">{t('documents.zReport.designation')}</th>
                <th className="py-2">{t('documents.zReport.time')}</th>
                <th className="py-2">{t('documents.zReport.tableClient')}</th>
                <th className="py-2 text-right">{t('documents.zReport.paidSession')}</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {orders.length > 0 ? orders.map((o: any) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-2 font-bold text-slate-400">#{o.id.slice(0, 6)}</td>
                  <td className="py-2 font-black text-[10px]">
                    {o.order_items?.length > 0
                      ? o.order_items.map((item: any) => `${item.quantity}x ${item.products?.name}`).join(', ')
                      : t('documents.zReport.directOrder')}
                  </td>
                  <td className="py-2 font-medium">{format.time(o.updated_at)}</td>
                  <td className="py-2 text-blue-600 font-bold">
                    {o.rooms?.number ? t('documents.zReport.room', { number: o.rooms.number }) : o.table_number ? t('documents.zReport.table', { number: o.table_number }) : o.guest_name || t('documents.zReport.counter')}
                  </td>
                  <td className="py-2 text-right font-black">
                    {Number(o.discount_amount) > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="line-through text-slate-400 text-[10px]">{formatFCFA(Number(o.subtotal || o.total + o.discount_amount))}</span>
                        <span className="text-red-500 text-[10px]">-{formatFCFA(o.discount_amount)}</span>
                      </div>
                    )}
                    {formatFCFA(o.total)}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-8 text-center italic text-slate-400">{t('documents.zReport.noOrders')}</td></tr>
              )}
            </tbody>
            {orders.length > 0 && (
              <tfoot>
                <tr className="font-black text-sm bg-slate-900 text-white">
                  <td colSpan={4} className="py-2 px-3">{t('documents.zReport.restaurantSubtotal')}</td>
                  <td className="py-2 px-3 text-right">{formatFCFA(orders.reduce((sum: number, o: any) => sum + Number(o.total), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}

        {/* DETAILED LOGS: HOTEL */}
        {showHotelSection && (
        <div className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 bg-slate-100 p-2 border-l-4 border-blue-500 flex items-center gap-2">
            <Hotel className="w-4 h-4" /> {t('documents.zReport.hotelTitle')}
          </h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase text-slate-500">
                <th className="py-2">{t('documents.zReport.ref')}</th>
                <th className="py-2">{t('documents.zReport.designationClient')}</th>
                <th className="py-2">{t('documents.zReport.typeNumber')}</th>
                <th className="py-2">{t('documents.zReport.paidAt')}</th>
                <th className="py-2 text-right">{t('documents.zReport.amountPaid')}</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {bookings.length > 0 ? bookings.map((b: any) => (
                <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-2 font-bold text-slate-400">#{b.id.slice(0, 6)}</td>
                  <td className="py-2 font-black">{b.guest_name || t('documents.zReport.walkIn')}</td>
                  <td className="py-2 font-medium">{t('documents.zReport.roomShort', { number: b.rooms?.number ?? '', type: b.rooms?.type ?? '' })}</td>
                  <td className="py-2 font-medium">{format.time(b.updated_at)}</td>
                  <td className="py-2 text-right font-black">{formatFCFA(b.total_amount)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-8 text-center italic text-slate-400">{t('documents.zReport.noBookings')}</td></tr>
              )}
            </tbody>
            {bookings.length > 0 && (
              <tfoot>
                <tr className="font-black text-sm bg-slate-900 text-white">
                  <td colSpan={4} className="py-2 px-3">{t('documents.zReport.hotelSubtotal')}</td>
                  <td className="py-2 px-3 text-right">{formatFCFA(bookings.reduce((sum: number, b: any) => sum + Number(b.total_amount), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}

        {/* Payment Methods Breakdown */}
        <div className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 border-b pb-1">{t('documents.zReport.paymentMethods')}</h2>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(paymentMethods).length > 0 ? Object.entries(paymentMethods).map(([method, amount]: [string, any]) => (
              <div key={method} className="bg-slate-50 p-3 border border-slate-200">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{method in PAYMENT_KEYS ? t(`common.paymentMethods.${method as keyof typeof PAYMENT_KEYS}`) : method}</p>
                <p className="text-lg font-black">{formatFCFA(amount)}</p>
              </div>
            )) : (
              <p className="col-span-4 text-xs italic text-slate-400">{t('documents.zReport.noPayments')}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        {shift.notes && (
          <div className="mb-12 p-4 border-2 border-dashed border-slate-200 bg-slate-50">
            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2 underline">{t('documents.zReport.notes')}</h3>
            <p className="text-xs italic text-slate-600">"{shift.notes}"</p>
          </div>
        )}

        {/* Signature Area */}
        <div className="mt-auto pt-8">
          <div className="grid grid-cols-2 gap-20">
            <div className="text-center pt-8 border-t-2 border-slate-900">
              <p className="text-xs font-black uppercase tracking-widest">{t('documents.zReport.cashierSignature', { name: shift.users?.last_name ?? '' })}</p>
              <div className="h-24"></div>
            </div>
            <div className="text-center pt-8 border-t-2 border-slate-900">
              <p className="text-xs font-black uppercase tracking-widest">{t('documents.zReport.managementSignature')}</p>
              <div className="h-24"></div>
            </div>
          </div>
          <div className="text-[9px] text-slate-400 text-center mt-8">
            {t('documents.zReport.footer')}
          </div>
        </div>

      </div>
    </div>
  );
}
