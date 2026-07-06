'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThermalReceiptPrintButton({ order }: { order: any }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Button
        onClick={handlePrint}
        variant="outline"
        className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 ml-2"
      >
        <Printer className="w-4 h-4 mr-2" />
        Imprimer Ticket (Thermique)
      </Button>

      {/* Composant caché pour l'impression thermique */}
      <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:text-black print:text-xs print:font-mono p-4" style={{ width: '80mm' }}>
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold uppercase">{order.structures?.name || 'SHEDE ERP'}</h1>
          <p className="text-xs">Ticket de caisse</p>
          <p className="text-xs">Commande #{order.id?.slice(0, 8).toUpperCase()}</p>
          <p className="text-xs">{new Date(order.created_at).toLocaleString('fr-FR')}</p>
        </div>

        <div className="border-t border-b border-black py-2 mb-2">
          {order.table_number && <p>Table: {order.table_number}</p>}
          {order.rooms?.number && <p>Chambre: {order.rooms.number}</p>}
          {order.source && <p>Source: {order.source}</p>}
        </div>

        <table className="w-full mb-4">
          <thead>
            <tr className="border-b border-black border-dashed">
              <th className="text-left font-normal pb-1">Qté</th>
              <th className="text-left font-normal pb-1">Article</th>
              <th className="text-right font-normal pb-1">Prix</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item: any) => (
              <tr key={item.id}>
                <td className="py-1 align-top">{item.quantity}x</td>
                <td className="py-1">{item.products?.name}</td>
                <td className="py-1 text-right">{item.total_price}</td>
              </tr>
            ))}
            {order.order_accompaniments?.map((acc: any) => (
              <tr key={acc.id} className="text-[10px]">
                <td className="py-0 align-top">{acc.quantity}x</td>
                <td className="py-0">+ {acc.accompaniments?.name}</td>
                <td className="py-0 text-right">{acc.total_price_snapshot > 0 ? acc.total_price_snapshot : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-black pt-2 text-right">
          <p className="text-sm font-bold flex justify-between">
            <span>SOUS-TOTAL:</span>
            <span>{order.subtotal} XOF</span>
          </p>
          
          {order.discount_amount > 0 && (
            <p className="flex justify-between mt-1">
              <span>REMISE:</span>
              <span>- {order.discount_amount} XOF</span>
            </p>
          )}

          {order.tip_amount > 0 && (
            <p className="flex justify-between mt-1">
              <span>POURBOIRE:</span>
              <span>{order.tip_amount} XOF</span>
            </p>
          )}

          <p className="text-lg font-bold flex justify-between mt-2 border-t border-black pt-2">
            <span>TOTAL:</span>
            <span>{order.total} XOF</span>
          </p>
        </div>

        <div className="text-center mt-6 pt-4 border-t border-dashed border-black">
          <p>Merci de votre visite !</p>
          <p className="text-[10px] mt-1">Généré par Shede ERP</p>
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
