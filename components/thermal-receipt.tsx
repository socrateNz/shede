'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  documentCurrency,
  formatDocumentAmount,
  saleTaxSummary,
  structureIdentityLines,
} from '@/lib/documents';
import { useT } from '@/lib/i18n/client';

export function ThermalReceiptPrintButton({ order }: { order: any }) {
  const handlePrint = () => {
    window.print();
  };

  const { t, format } = useT();
  const structure = order.structures;
  const currency = documentCurrency(structure);
  const money = (value: number | string | null | undefined) => formatDocumentAmount(value, currency, format.intl);
  const taxSummary = saleTaxSummary(order);
  const takeawayFee = Number(order.takeaway_fee) || 0;
  const deliveryFee = Number(order.delivery_fee) || 0;
  const isPaid = order.status === 'COMPLETED';

  return (
    <>
      <Button
        onClick={handlePrint}
        variant="outline"
        className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 ml-2"
      >
        <Printer className="w-4 h-4 mr-2" />
        {t('documents.receipt.thermalButton')}
      </Button>

      {/* Composant caché pour l'impression thermique */}
      <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:text-black print:text-xs print:font-mono p-4" style={{ width: '80mm' }}>
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold uppercase">{structure?.name || 'SHEDE ERP'}</h1>
          {structureIdentityLines(structure, t).map((line) => (
            <p key={line} className="text-[10px]">{line}</p>
          ))}
          <p className="text-xs mt-2 font-bold">
            {isPaid && order.invoice_number ? t('documents.receipt.invoiceNumber', { number: order.invoice_number }) : t('documents.receipt.ticket')}
          </p>
          <p className="text-xs">{t('documents.receipt.orderNumber', { number: order.id?.slice(0, 8).toUpperCase() })}</p>
          <p className="text-xs">{format.dateTime(order.paid_at || order.created_at)}</p>
        </div>

        <div className="border-t border-b border-black py-2 mb-2">
          {order.table_number && <p>{t('documents.receipt.table', { table: order.table_number })}</p>}
          {order.rooms?.number && <p>{t('documents.receipt.room', { room: order.rooms.number })}</p>}
          {order.consumption_type === 'TAKEAWAY' && <p>{t('documents.receipt.takeaway')}</p>}
          {order.consumption_type === 'DELIVERY' && (
            <>
              <p>{t('documents.receipt.delivery', { address: [order.delivery_district, order.delivery_city].filter(Boolean).join(', ') })}</p>
              {order.delivery_landmark && <p>{t('documents.receipt.landmark', { landmark: order.delivery_landmark })}</p>}
              {order.phone && <p>{t('documents.receipt.phoneLine', { phone: order.phone })}</p>}
            </>
          )}
          {order.source && <p>{t('documents.receipt.source', { source: order.source })}</p>}
        </div>

        <table className="w-full mb-4">
          <thead>
            <tr className="border-b border-black border-dashed">
              <th className="text-left font-normal pb-1">{t('documents.receipt.qty')}</th>
              <th className="text-left font-normal pb-1">{t('documents.receipt.item')}</th>
              <th className="text-right font-normal pb-1">{t('documents.receipt.price')}</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item: any) => (
              <tr key={item.id}>
                <td className="py-1 align-top">{item.quantity}x</td>
                <td className="py-1">{item.products?.name}</td>
                <td className="py-1 text-right">{money(item.total_price)}</td>
              </tr>
            ))}
            {order.order_accompaniments?.map((acc: any) => (
              <tr key={acc.id} className="text-[10px]">
                <td className="py-0 align-top">{acc.quantity}x</td>
                <td className="py-0">+ {acc.accompaniments?.name}</td>
                <td className="py-0 text-right">{acc.total_price_snapshot > 0 ? money(acc.total_price_snapshot) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-black pt-2 text-right">
          <p className="text-sm font-bold flex justify-between">
            <span>{t('documents.receipt.subtotal').toUpperCase()} :</span>
            <span>{money(order.subtotal)}</span>
          </p>

          {order.discount_amount > 0 && (
            <p className="flex justify-between mt-1">
              <span>{t('documents.receipt.discount').toUpperCase()} :</span>
              <span>- {money(order.discount_amount)}</span>
            </p>
          )}

          {takeawayFee > 0 && (
            <p className="flex justify-between mt-1">
              <span>{t('documents.receipt.packaging').toUpperCase()} :</span>
              <span>{money(takeawayFee)}</span>
            </p>
          )}

          {deliveryFee > 0 && (
            <p className="flex justify-between mt-1">
              <span>{t('documents.receipt.delivery_fee').toUpperCase()} :</span>
              <span>{money(deliveryFee)}</span>
            </p>
          )}

          {taxSummary && (
            <>
              <p className="flex justify-between mt-1 border-t border-dashed border-black pt-1">
                <span>{t('documents.receipt.net').toUpperCase()} :</span>
                <span>{money(taxSummary.net)}</span>
              </p>
              <p className="flex justify-between mt-1">
                <span>{t('documents.receipt.vat', { rate: `${format.number(taxSummary.rate, { maximumFractionDigits: 2 })} %` }).toUpperCase()} :</span>
                <span>{money(taxSummary.tax)}</span>
              </p>
              <p className="flex justify-between mt-1">
                <span>{t('documents.receipt.gross').toUpperCase()} :</span>
                <span>{money(taxSummary.totalWithTax)}</span>
              </p>
            </>
          )}

          {order.tip_amount > 0 && (
            <p className="flex justify-between mt-1">
              <span>{t('documents.receipt.tip').toUpperCase()} :</span>
              <span>{money(order.tip_amount)}</span>
            </p>
          )}

          <p className="text-lg font-bold flex justify-between mt-2 border-t border-black pt-2">
            <span>{isPaid ? t('documents.receipt.totalPaid') : t('documents.receipt.totalDue')} :</span>
            <span>{money(order.total)}</span>
          </p>
        </div>

        <div className="text-center mt-6 pt-4 border-t border-dashed border-black">
          <p>{t('documents.receipt.thanks')}</p>
          <p className="text-[10px] mt-1">{t('documents.receipt.generatedBy')}</p>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}} />
    </>
  );
}
