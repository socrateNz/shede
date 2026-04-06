import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const generateBookingReceipt = async (booking: {
  id: string;
  guest_name?: string;
  check_in: string;
  check_out: string;
  total_amount?: number;
  rooms: {
    name: string;
    price: number;
  };
}) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  
  const doc = new jsPDF();
  const date = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr });

  // Header
  doc.setFontSize(22);
  doc.setTextColor(40, 44, 52);
  doc.text('REÇU DE RÉSERVATION', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`N° Facture : ${booking.id.toUpperCase().slice(0, 8)}`, 15, 35);
  doc.text(`Date : ${date}`, 15, 40);

  // Client Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Client :', 15, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(booking.guest_name || 'Client de passage', 35, 55);

  // Table
  autoTable(doc, {
    startY: 65,
    head: [['Désignation', 'Pariode', 'Prix Unit.', 'Total (FCFA)']],
    body: [
      [
        `Chambre ${booking.rooms.name}`,
        `Du ${format(new Date(booking.check_in), 'dd/MM/yyyy')} au ${format(new Date(booking.check_out), 'dd/MM/yyyy')}`,
        `${(booking.rooms.price || 0).toLocaleString()}`,
        `${(booking.total_amount || 0).toLocaleString()}`
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [40, 44, 52], fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 70 },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' }
    }
  });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL À PAYER :  ${(booking.total_amount || 0).toLocaleString()} FCFA`, 195, finalY, { align: 'right' });

  // Signature / Stamp
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Cachet et Signature de la Réception', 15, finalY + 30);
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Merci de votre confiance. À bientôt !', 105, 285, { align: 'center' });

  // Download
  doc.save(`recu_${booking.id.slice(0, 8)}.pdf`);
};

export const generateOrderReceipt = async (order: {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  table_number?: number | null;
  rooms?: { number: string } | null;
  created_at: string;
  structures?: { name: string } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products: { name: string };
    promotion_id?: string;
  }>;
  order_accompaniments?: Array<{
    parent_order_item_id: string;
    quantity: number;
    unit_price_snapshot: number;
    total_price_snapshot: number;
    accompaniments: { name: string };
  }>;
}) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const date = format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: fr });
  const structureName = order.structures?.name || 'SHEDE SYSTEM';

  // Header - Corporate Style
  doc.setFontSize(22);
  doc.setTextColor(41, 128, 185); // Professional Blue
  doc.text(structureName.toUpperCase(), 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(40, 44, 52);
  doc.text('REÇU DE COMMANDE', 105, 30, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`N° de Commande : ${order.id.split('-')[0].toUpperCase()}`, 15, 45);
  doc.text(`Date d'émission : ${date}`, 15, 50);
  
  // Status with color
  const isPaid = order.status === 'COMPLETED';
  if (isPaid) {
    doc.setTextColor(39, 174, 96); // Green
  } else {
    doc.setTextColor(231, 76, 60); // Red
  }
  doc.setFont('helvetica', 'bold');
  doc.text(`Statut : ${isPaid ? 'PAYÉ' : 'NON PAYÉ'}`, 15, 55);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  // Source Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 44, 52);
  const source = order.rooms?.number 
    ? `Réf : Chambre ${order.rooms.number}` 
    : order.table_number 
      ? `Réf : Table ${order.table_number}` 
      : 'Réf : À emporter';
  doc.text(source, 15, 65);

  // Helper function for formatted numbers
  const formatPrice = (num: number) => {
    return num.toLocaleString('fr-FR').replace(/\s/g, ' ') + ' FCFA';
  };

  // Table Data Processing
  const bodyRows: any[] = [];
  
  order.order_items?.filter(it => it.total_price > 0 || it.unit_price > 0).forEach(item => {
    // Detect if this line has bundled free items
    const expectedTotal = item.quantity * item.unit_price;
    const isBogoDetected = expectedTotal > item.total_price && item.total_price > 0;
    
    if (isBogoDetected) {
      const paidUnits = Math.floor(item.total_price / item.unit_price);
      const freeUnits = item.quantity - paidUnits;
      
      bodyRows.push([
        item.products.name,
        `${paidUnits}`,
        formatPrice(item.unit_price),
        formatPrice(paidUnits * item.unit_price)
      ]);
      
      bodyRows.push([
        `${item.products.name} (PROMO)`,
        `${freeUnits}`,
        `OFFERT`,
        `0 FCFA`
      ]);
    } else if (item.total_price === 0 && item.quantity > 0) {
      bodyRows.push([
        `${item.products.name} (OFFERT)`,
        `${item.quantity}`,
        `0 FCFA`,
        `0 FCFA`
      ]);
    } else {
      bodyRows.push([
        item.products.name,
        `${item.quantity}`,
        formatPrice(item.unit_price),
        formatPrice(item.total_price)
      ]);
    }

    // Add Accompaniments if any
    if (order.order_accompaniments && Array.isArray(order.order_accompaniments)) {
      const itemAccs = order.order_accompaniments.filter(acc => acc.parent_order_item_id === item.id);
      itemAccs.forEach(acc => {
        const accName = acc.accompaniments?.name || 'Accompagnement';
        bodyRows.push([
          `  + ${accName}`,
          `${acc.quantity}`,
          formatPrice(acc.unit_price_snapshot || 0),
          formatPrice(acc.total_price_snapshot || 0)
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: 75,
    head: [['Description', 'Qté', 'P.U (FCFA)', 'Total (FCFA)']],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], fontSize: 9, cellPadding: 2 },
    bodyStyles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 45, halign: 'right' }
    }
  });

  // Summary section
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 44, 52);
  
  const summaryX = 120; // Moved further left to avoid overlap
  const summaryValX = 195;

  doc.text('Sous-total :', summaryX, finalY);
  doc.text(formatPrice(order.subtotal), summaryValX, finalY, { align: 'right' });
  
  let currentY = finalY;

  if (order.discount_amount > 0) {
    currentY += 7;
    doc.setTextColor(231, 76, 60); // Red for discounts
    doc.text('Remise Promo :', summaryX, currentY);
    doc.text(`- ${formatPrice(order.discount_amount)}`, summaryValX, currentY, { align: 'right' });
    doc.setTextColor(40, 44, 52);
  }

  const rectY = currentY + 5;
  doc.setLineWidth(0.5);
  doc.line(summaryX - 5, rectY, summaryValX, rectY);
  
  doc.setFontSize(13); // Slightly smaller to avoid overlap
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PAYÉ :', summaryX, rectY + 10);
  doc.text(formatPrice(order.total), summaryValX, rectY + 10, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Merci de votre visite ! Ce document fait office de reçu officiel.', 105, doc.internal.pageSize.height - 10, { align: 'center' });

  // Download
  doc.save(`recu_${structureName.replace(/\s+/g, '_').toLowerCase()}_${order.id.split('-')[0].toUpperCase()}.pdf`);
};
