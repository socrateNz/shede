'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function DownloadInvoiceButton({ order }: { order: any }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = () => {
    try {
      setLoading(true);
      const doc = new jsPDF();
    
    // Structure Name
    const structureName = order.structures?.name || 'Établissement';
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text(structureName, 14, 22);
    
    doc.setFontSize(14);
    doc.text('Reçu / Facture', 14, 32);
    
    // Details
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`N° de Commande : ${order.id.split('-')[0]}`, 14, 42);
    doc.text(`Date : ${new Date(order.created_at).toLocaleString()}`, 14, 48);
    
    // Delivery Context
    let deliveryText = 'À emporter';
    if (order.rooms?.number) {
      deliveryText = `Chambre ${order.rooms.number}`;
    } else if (order.table_number) {
      deliveryText = `Table ${order.table_number}`;
    }
    doc.text(`Livraison : ${deliveryText}`, 14, 54);

    // Table
    const tableColumn = ["Article", "Quantité", "Prix Unitaire", "Total"];
    const tableRows: any[] = [];
    
    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach((item: any) => {
        const itemName = item.products?.name || 'Article inconnu';
        tableRows.push([
          itemName,
          item.quantity,
          `${item.unit_price} FCFA`,
          `${item.total_price} FCFA`
        ]);

        // Find accompaniments for this item
        if (order.order_accompaniments && Array.isArray(order.order_accompaniments)) {
           const itemAccs = order.order_accompaniments.filter((acc: any) => acc.parent_order_item_id === item.id);
           itemAccs.forEach((acc: any) => {
              const accName = acc.accompaniments?.name || 'Accompagnement';
              tableRows.push([
                 `  + ${accName}`,
                 acc.quantity,
                 `${acc.unit_price_snapshot} FCFA`,
                 `${acc.total_price_snapshot} FCFA`
              ]);
           });
        }
      });
    }

    autoTable(doc, {
      startY: 65,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
    });

    const finalY = (doc as any).lastAutoTable.finalY || 65;

    // Totals
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(`Sous-total : ${order.subtotal} FCFA`, 14, finalY + 10);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL : ${order.total} FCFA`, 14, finalY + 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text('Merci de votre visite !', 14, finalY + 30);

    doc.save(`Facture_${order.id.split('-')[0]}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      title="Télécharger la facture"
      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
    >
      <Download className={`w-4 h-4 ${loading ? 'animate-pulse text-blue-500' : ''}`} />
    </button>
  );
}
