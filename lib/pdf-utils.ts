import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatFCFA as formatFCFAIntl } from '@/lib/utils';

// jsPDF's default fonts don't have a glyph for the narrow no-break space that
// Intl's fr-FR currency formatter uses as a thousands separator (it renders
// as a stray "/"). Swap it for a plain ASCII space, safe in any font.
function formatFCFA(amount: number): string {
  return formatFCFAIntl(amount).replace(/\s/g, ' ');
}

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

const RESTAURANT_MODULES = ['POS', 'CUISINE', 'BAR', 'TABLES', 'LIVRAISON', 'CLIENT_APP'];

const MODULE_LABELS: Record<string, string> = {
  POS: 'Caisse (POS)',
  CLIENT_APP: 'App Client (B2C)',
  CUISINE: 'Cuisine (KDS)',
  BAR: 'Bar',
  LIVRAISON: 'Livraison',
  TABLES: 'Plan de salle',
  HOTEL: 'Hôtel (PMS)',
  STOCK: 'Stock',
  PROMOTION: 'Promotions',
  RH: 'Ressources Humaines',
  CRM: 'CRM Clients',
};

function getModuleMetric(moduleKey: string, summary: any): { value: string; note: string } | null {
  if (moduleKey === 'POS') {
    return { value: formatFCFA(summary.orderRevenue), note: `${summary.orderCount} commande(s) encaissée(s)` };
  }
  if (moduleKey === 'HOTEL') {
    return { value: formatFCFA(summary.bookingRevenue), note: `${summary.bookingCount} réservation(s) réglée(s)` };
  }
  if (moduleKey === 'PROMOTION') {
    return { value: `-${formatFCFA(summary.totalDiscounts)}`, note: 'Total des remises accordées' };
  }
  return null;
}

export const generateShiftReportPdf = async (shiftId: string) => {
  const { getShiftReport } = await import('@/app/actions/shifts');
  const data = await getShiftReport(shiftId);
  if (!data) throw new Error('Rapport introuvable');

  const { shift, orders, bookings, paymentMethods, modules, summary } = data;

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 15;

  const ensureSpace = (y: number, needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      return 20;
    }
    return y;
  };

  // Header
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(shift.structures?.name?.toUpperCase() || 'ÉTABLISSEMENT', marginX, 20);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(shift.structures?.address || 'Adresse non spécifiée', marginX, 26);
  doc.text(`Tél: ${shift.structures?.phone || 'N/A'}`, marginX, 31);

  doc.setFontSize(14);
  doc.setTextColor(20, 20, 30);
  doc.setFont('helvetica', 'bold');
  doc.text('RAPPORT Z', pageWidth - marginX, 20, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'normal');
  doc.text(`Session #${shift.id.slice(0, 8).toUpperCase()}`, pageWidth - marginX, 26, { align: 'right' });
  doc.text(format(new Date(), 'dd/MM/yyyy', { locale: fr }), pageWidth - marginX, 31, { align: 'right' });

  doc.setDrawColor(20, 20, 30);
  doc.setLineWidth(0.8);
  doc.line(marginX, 36, pageWidth - marginX, 36);

  let y = 46;

  // Responsable de session
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Responsable de Session', marginX, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Caissier : ${shift.users?.first_name || ''} ${shift.users?.last_name || ''}`, marginX, y);
  y += 5;
  doc.text(`Ouverture : ${format(new Date(shift.opened_at), 'dd/MM/yyyy HH:mm', { locale: fr })}`, marginX, y);
  y += 5;
  doc.text(
    `Fermeture : ${shift.closed_at ? format(new Date(shift.closed_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'NON CLÔTURÉ'}`,
    marginX,
    y
  );

  y += 10;

  // Résumé des flux
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Résumé des Flux', marginX, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const flowLines: [string, string][] = [
    ['Fond de caisse', formatFCFA(summary.openingBalance)],
    ['Ventes (Brut)', formatFCFA(summary.grossSales)],
    ['Promotions / Remises', `-${formatFCFA(summary.totalDiscounts)}`],
    ['Ventes Net (Payé)', formatFCFA(summary.netSales)],
    ['Argent Attendu', formatFCFA(summary.expectedAmount)],
  ];
  flowLines.forEach(([label, value]) => {
    doc.text(label, marginX, y);
    doc.text(value, pageWidth - marginX, y, { align: 'right' });
    y += 5;
  });

  y += 6;

  // Écart de caisse
  const isNegative = Number(summary.difference) < 0;
  doc.setDrawColor(20, 20, 30);
  doc.setLineWidth(0.6);
  doc.rect(marginX, y, pageWidth - marginX * 2, 22);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text('TOTAL RÉEL COMPTÉ EN CAISSE', marginX + 4, y + 7);
  doc.text('ÉCART DE CAISSE', pageWidth - marginX - 4, y + 7, { align: 'right' });
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 30);
  doc.text(formatFCFA(summary.actualAmount ?? 0), marginX + 4, y + 16);
  doc.setTextColor(isNegative ? 200 : 0, isNegative ? 30 : 130, isNegative ? 30 : 60);
  const difference = summary.difference ?? 0;
  doc.text(
    `${difference > 0 ? '+' : ''}${formatFCFA(difference)}`,
    pageWidth - marginX - 4,
    y + 16,
    { align: 'right' }
  );
  doc.setTextColor(20, 20, 30);
  y += 32;

  // Résumé financier par module
  const financialModules = modules
    .map((m: string) => ({ key: m, label: MODULE_LABELS[m] || m, metric: getModuleMetric(m, summary) }))
    .filter((m: any) => m.metric !== null);

  if (financialModules.length > 0) {
    y = ensureSpace(y, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Résumé Financier par Module', marginX, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Module', 'Montant', 'Détail']],
      body: financialModules.map((m: any) => [m.label, m.metric.value, m.metric.note]),
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 30], fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Ventes Restaurant (détails) — affiché dès que la structure a un module de
  // restauration actif, même sans commande (mirroir de rapport-z.tsx), pour que
  // le PDF ne "perde" pas cette section par rapport à l'aperçu HTML.
  const showRestaurantSection = modules.some((m: string) => RESTAURANT_MODULES.includes(m));
  if (showRestaurantSection) {
    y = ensureSpace(y, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Ventes Restaurant (Détails)', marginX, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Réf', 'Désignation', 'Table / Client', 'Payé (Session)']],
      body:
        orders.length > 0
          ? orders.map((o: any) => [
              `#${o.id.slice(0, 6)}`,
              o.order_items?.length > 0
                ? o.order_items.map((it: any) => `${it.quantity}x ${it.products?.name}`).join(', ')
                : 'Commande Directe',
              o.rooms?.number ? `Chambre ${o.rooms.number}` : o.table_number ? `Table ${o.table_number}` : o.guest_name || 'Comptoir',
              formatFCFA(o.total),
            ])
          : [[{ content: 'Aucune commande restaurant pendant cette session.', colSpan: 4, styles: { halign: 'center', fontStyle: 'italic', textColor: [150, 150, 150] } }]],
      foot: orders.length > 0
        ? [['', '', 'SOUS-TOTAL', formatFCFA(orders.reduce((s: number, o: any) => s + Number(o.total), 0))]]
        : undefined,
      theme: 'grid',
      headStyles: { fillColor: [230, 126, 34], fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      footStyles: { fillColor: [20, 20, 30], fontSize: 9, halign: 'right' },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Réservations Hôtel (détails) — même logique, affiché dès que le module HOTEL est actif
  const showHotelSection = modules.includes('HOTEL');
  if (showHotelSection) {
    y = ensureSpace(y, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Réservations Hôtel (Détails)', marginX, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Réf', 'Client', 'Chambre', 'Montant Payé']],
      body:
        bookings.length > 0
          ? bookings.map((b: any) => [
              `#${b.id.slice(0, 6)}`,
              b.guest_name || 'Client de passage',
              `${b.rooms?.number || ''} (${b.rooms?.type || ''})`,
              formatFCFA(b.total_amount),
            ])
          : [[{ content: 'Aucune réservation hôtel pendant cette session.', colSpan: 4, styles: { halign: 'center', fontStyle: 'italic', textColor: [150, 150, 150] } }]],
      foot: bookings.length > 0
        ? [['', '', 'SOUS-TOTAL', formatFCFA(bookings.reduce((s: number, b: any) => s + Number(b.total_amount), 0))]]
        : undefined,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      footStyles: { fillColor: [20, 20, 30], fontSize: 9, halign: 'right' },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Modes de paiement
  const paymentEntries = Object.entries(paymentMethods || {});
  if (paymentEntries.length > 0) {
    y = ensureSpace(y, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Récapitulatif des Modes de Paiement', marginX, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Méthode', 'Montant']],
      body: paymentEntries.map(([method, amount]) => [method, formatFCFA(Number(amount))]),
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 30], fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Notes
  if (shift.notes) {
    y = ensureSpace(y, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Observations Générales :', marginX, y);
    y += 5;
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(`"${shift.notes}"`, pageWidth - marginX * 2);
    doc.text(noteLines, marginX, y);
    y += noteLines.length * 5 + 5;
  }

  // Signatures
  y = ensureSpace(y, 30);
  y += 15;
  doc.setDrawColor(20, 20, 30);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, marginX + 70, y);
  doc.line(pageWidth - marginX - 70, y, pageWidth - marginX, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Visa du Caissier (${shift.users?.last_name || ''})`, marginX, y + 5);
  doc.text('Visa de la Direction', pageWidth - marginX - 70, y + 5);

  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    'Document généré électroniquement par Shede SaaS - Certifié conforme.',
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  doc.save(`rapport-z_${shift.id.slice(0, 8)}.pdf`);
};

export const generateQrCodesPdf = async (
  groups: { floorName: string; tables: { id: string; name: string }[] }[],
  structureId: string,
  structureName: string,
  baseUrl: string,
  cardsPerPage: number
) => {
  const QRCode = await import('qrcode');
  const { default: jsPDF } = await import('jspdf');

  const LAYOUT: Record<number, { cols: number; rows: number }> = {
    1: { cols: 1, rows: 1 },
    2: { cols: 1, rows: 2 },
    4: { cols: 2, rows: 2 },
    6: { cols: 2, rows: 3 },
    8: { cols: 2, rows: 4 },
    12: { cols: 3, rows: 4 },
  };
  const { cols, rows } = LAYOUT[cardsPerPage] || LAYOUT[4];
  const perPage = cols * rows;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const headerH = 12;
  const gridTop = margin + headerH;
  const cellW = (pageW - margin * 2) / cols;
  const cellH = (pageH - margin * 2 - headerH) / rows;

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  let firstPage = true;
  for (const group of groups) {
    const pages = chunk(group.tables, perPage);
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      if (!firstPage) doc.addPage();
      firstPage = false;

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 30);
      doc.text(`${group.floorName}${pageIndex > 0 ? ' (suite)' : ''}`, margin, margin + 6);

      const cards = pages[pageIndex];
      for (let i = 0; i < cards.length; i++) {
        const table = cards[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = margin + col * cellW;
        const y = gridTop + row * cellH;

        doc.setDrawColor(180);
        doc.setLineDashPattern([1, 1], 0);
        doc.rect(x + 2, y + 2, cellW - 4, cellH - 4);
        doc.setLineDashPattern([], 0);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 30);
        doc.text(structureName.toUpperCase(), x + cellW / 2, y + 8, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text('Scannez pour commander', x + cellW / 2, y + 12, { align: 'center' });

        const tableUrl = `${baseUrl}/client/structure/${structureId}?tableId=${table.id}&tableName=${encodeURIComponent(table.name)}`;
        const dataUrl = await QRCode.toDataURL(tableUrl, { margin: 1, width: 300 });
        const qrSize = Math.min(cellW, cellH) * 0.55;
        doc.addImage(dataUrl, 'PNG', x + (cellW - qrSize) / 2, y + 15, qrSize, qrSize);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 30);
        doc.text(table.name, x + cellW / 2, y + 15 + qrSize + 8, { align: 'center' });
      }
    }
  }

  doc.save(`qrcodes_${structureName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
};
