'use client';

import { useRef } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  documentCurrency,
  formatDocumentAmount,
  saleTaxSummary,
  initialsOf,
  ticketDetails,
} from '@/lib/documents';
import { useT } from '@/lib/i18n/client';

export function ThermalReceiptPrintButton({ order }: { order: any }) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const pageStyleRef = useRef<HTMLStyleElement>(null);

  // Page d'impression = taille exacte du ticket : 80 mm × hauteur mesurée (en mm), sans marges.
  // (« size: 80mm auto » n'est pas valide en CSS : le navigateur l'ignorait et imprimait en A4.)
  const handlePrint = () => {
    const height = ticketRef.current?.getBoundingClientRect().height ?? 0;
    const heightMm = Math.max(Math.ceil((height * 25.4) / 96) + 2, 60);
    if (pageStyleRef.current) {
      pageStyleRef.current.textContent = `@media print { @page { size: 80mm ${heightMm}mm; margin: 0; } }`;
    }
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
        className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-50 hover:bg-slate-700 ml-2"
      >
        <Printer className="w-4 h-4 mr-2" />
        {t('documents.receipt.thermalButton')}
      </Button>

      {/* Ticket pour l'impression thermique : rendu hors de l'écran (pour pouvoir le mesurer), visible seulement à l'impression */}
      <div
        ref={ticketRef}
        aria-hidden
        className="couleurs-fixes thermal-ticket pointer-events-none fixed left-[-10000px] top-0 bg-white text-black text-xs font-mono p-[4mm]"
        style={{ width: '80mm', boxSizing: 'border-box' }}
      >
        <div className="text-center mb-4">
          {/* En-tête : logo à gauche (initiales sans logo), nom et coordonnées à droite */}
          <div className="flex items-start gap-[3mm] text-left">
            {structure?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={structure.logo_url}
                alt=""
                className="block shrink-0 object-contain"
                style={{ maxWidth: '24mm', maxHeight: '22mm', filter: 'grayscale(1) contrast(1.15)' }}
              />
            ) : (
              <div className="flex shrink-0 items-center justify-center rounded-md border-2 border-black text-lg font-bold" style={{ width: '16mm', height: '16mm' }}>
                {initialsOf(structure?.name || 'Shede')}
              </div>
            )}
            <div className="min-w-0 flex-1 text-right">
              <h1 className="text-sm font-bold uppercase leading-tight">{structure?.name || 'SHEDE ERP'}</h1>
              <div className="mt-0.5 space-y-px">
                {ticketDetails(structure, t).map((line) => (
                  <p key={line} className="text-[9px] leading-snug">{line}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-2 border-t-2 border-black" />
          <div className="mt-[2px] border-t border-black" />
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
          .thermal-ticket, .thermal-ticket * {
            visibility: visible;
          }
          .thermal-ticket {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }
        }
      `}} />
      {/* Taille de la page, écrite au moment d'imprimer */}
      <style ref={pageStyleRef} />
    </>
  );
}
