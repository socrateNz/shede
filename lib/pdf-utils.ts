import {
  documentCurrency,
  formatDocumentAmount,
  saleTaxSummary,
  structureIdentityLines,
  type DocumentStructure,
} from '@/lib/documents';
import type { Translator } from '@/lib/i18n/translate';
import type { Formatters } from '@/lib/i18n/format';

type JsPdf = InstanceType<typeof import('jspdf').default>;

/** Langue du document : celle de l'utilisateur qui l'imprime (hook useT). */
export type DocumentI18n = { t: Translator; format: Formatters };

/** Espaces fines (séparateurs de milliers, « % ») remplacées : les polices PDF standard ne les ont pas. */
function pdfText(value: string) {
  return value.replace(/[  ]/g, ' ');
}

function rateLabel(i18n: DocumentI18n, rate: number) {
  return pdfText(`${i18n.format.number(rate, { maximumFractionDigits: 2 })} %`);
}

/**
 * En-tête commun : nom de l'établissement, puis adresse, contact et
 * NIU / RCCM. Renvoie l'ordonnée disponible sous l'en-tête.
 */
function drawStructureHeader(doc: JsPdf, i18n: DocumentI18n, structure: DocumentStructure | null | undefined, fallbackName: string) {
  const name = structure?.name || fallbackName;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text(name.toUpperCase(), 105, 20, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90);
  let y = 26;
  for (const line of structureIdentityLines(structure, i18n.t)) {
    doc.text(line, 105, y, { align: 'center' });
    y += 4.5;
  }
  return y + 2;
}

/** Récapitulatif aligné à droite ; renvoie l'ordonnée suivante. */
function drawSummaryLine(
  doc: JsPdf,
  label: string,
  value: string,
  y: number,
  options: { bold?: boolean; size?: number; color?: [number, number, number] } = {}
) {
  const labelX = 120;
  const valueX = 195;
  doc.setFontSize(options.size ?? 10);
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setTextColor(...(options.color ?? [40, 44, 52]));
  doc.text(label, labelX, y);
  doc.text(value, valueX, y, { align: 'right' });
  return y + 7;
}

export const generateBookingReceipt = async (
  booking: {
    id: string;
    guest_name?: string;
    check_in: string;
    check_out: string;
    total_amount?: number;
    tax_amount?: number | null;
    tax_rate?: number | null;
    invoice_number?: string | null;
    is_paid?: boolean | null;
    rooms: {
      number?: string | null;
      name?: string | null;
      price: number;
      structures?: DocumentStructure | null;
    };
  },
  i18n: DocumentI18n
) => {
  const { t, format } = i18n;
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const structure = booking.rooms?.structures;
  const currency = documentCurrency(structure);
  const money = (value: number | null | undefined) => formatDocumentAmount(value, currency, format.intl);
  const roomLabel = booking.rooms?.number ?? booking.rooms?.name ?? '';

  const headerBottom = drawStructureHeader(doc, i18n, structure, 'Shede');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 44, 52);
  doc.text(
    booking.invoice_number
      ? t('documents.receipt.invoiceTitle', { number: booking.invoice_number })
      : t('documents.booking.title'),
    105,
    headerBottom + 4,
    { align: 'center' }
  );

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(t('documents.booking.reference', { ref: booking.id.toUpperCase().slice(0, 8) }), 15, headerBottom + 16);
  doc.text(pdfText(t('documents.booking.date', { date: format.dateTime(new Date()) })), 15, headerBottom + 21);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(t('documents.booking.client'), 15, headerBottom + 32);
  doc.setFont('helvetica', 'normal');
  doc.text(booking.guest_name || t('documents.booking.walkIn'), 40, headerBottom + 32);

  autoTable(doc, {
    startY: headerBottom + 40,
    head: [[
      t('documents.booking.designation'),
      t('documents.booking.period'),
      t('documents.booking.unitPrice'),
      t('documents.receipt.lineTotal', { currency }),
    ]],
    body: [
      [
        t('documents.booking.room', { number: roomLabel }),
        pdfText(t('documents.booking.dates', { from: format.date(booking.check_in), to: format.date(booking.check_out) })),
        money(booking.rooms?.price || 0),
        money(booking.total_amount || 0),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [40, 44, 52], fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 65 },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 10;
  const taxSummary = saleTaxSummary(booking);
  if (taxSummary) {
    y = drawSummaryLine(doc, `${t('documents.receipt.net')} :`, money(taxSummary.net), y);
    y = drawSummaryLine(doc, `${t('documents.receipt.vat', { rate: rateLabel(i18n, taxSummary.rate) })} :`, money(taxSummary.tax), y);
  }
  y = drawSummaryLine(
    doc,
    `${booking.is_paid ? t('documents.receipt.totalPaid') : t('documents.receipt.totalDue')} :`,
    money(booking.total_amount || 0),
    y + 3,
    { bold: true, size: 13 }
  );

  // Signature / Stamp
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 44, 52);
  doc.text(t('documents.booking.stamp'), 15, y + 20);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(t('documents.booking.thanks'), 105, 285, { align: 'center' });

  doc.save(`receipt_${booking.invoice_number ?? booking.id.slice(0, 8)}.pdf`);
};

export const generateOrderReceipt = async (
  order: {
    id: string;
    status: string;
    total: number;
    subtotal: number;
    discount_amount: number;
    tax?: number | null;
    tax_rate?: number | null;
    tip_amount?: number | null;
    takeaway_fee?: number | null;
    delivery_fee?: number | null;
    consumption_type?: string | null;
    delivery_district?: string | null;
    delivery_city?: string | null;
    delivery_landmark?: string | null;
    invoice_number?: string | null;
    paid_at?: string | null;
    table_number?: number | null;
    rooms?: { number: string } | null;
    created_at: string;
    structures?: DocumentStructure | null;
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
  },
  i18n: DocumentI18n
) => {
  const { t, format } = i18n;
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const date = pdfText(format.dateTime(order.paid_at || order.created_at));
  const structureName = order.structures?.name || 'SHEDE SYSTEM';
  const currency = documentCurrency(order.structures);
  const formatPrice = (num: number | null | undefined) => formatDocumentAmount(num, currency, format.intl);
  const isPaid = order.status === 'COMPLETED';

  const headerBottom = drawStructureHeader(doc, i18n, order.structures, 'SHEDE SYSTEM');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 44, 52);
  doc.text(
    isPaid && order.invoice_number
      ? t('documents.receipt.invoiceTitle', { number: order.invoice_number })
      : t('documents.receipt.orderReceipt'),
    105,
    headerBottom + 4,
    { align: 'center' }
  );

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(t('documents.receipt.orderRef', { number: order.id.split('-')[0].toUpperCase() }), 15, headerBottom + 16);
  doc.text(t('documents.receipt.issuedAt', { date }), 15, headerBottom + 21);

  if (isPaid) {
    doc.setTextColor(39, 174, 96);
  } else {
    doc.setTextColor(231, 76, 60);
  }
  doc.setFont('helvetica', 'bold');
  doc.text(
    t('documents.receipt.status', { status: isPaid ? t('documents.receipt.paid') : t('documents.receipt.unpaid') }),
    15,
    headerBottom + 26
  );
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 44, 52);
  const source = order.consumption_type === 'DELIVERY'
    ? t('documents.receipt.delivery', { address: [order.delivery_district, order.delivery_city].filter(Boolean).join(', ') })
    : order.rooms?.number
      ? t('documents.receipt.refRoom', { room: order.rooms.number })
      : order.table_number
        ? t('documents.receipt.refTable', { table: order.table_number })
        : t('documents.receipt.refTakeaway');
  doc.text(source, 15, headerBottom + 36);
  if (order.consumption_type === 'DELIVERY' && order.delivery_landmark) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(t('documents.receipt.landmark', { landmark: order.delivery_landmark }).slice(0, 110), 15, headerBottom + 41);
  }

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
        t('documents.receipt.promo', { name: item.products.name }),
        `${freeUnits}`,
        t('documents.receipt.free'),
        formatPrice(0)
      ]);
    } else if (item.total_price === 0 && item.quantity > 0) {
      bodyRows.push([
        t('documents.receipt.offered', { name: item.products.name }),
        `${item.quantity}`,
        formatPrice(0),
        formatPrice(0)
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
        const accName = acc.accompaniments?.name || t('documents.receipt.accompaniment');
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
    startY: headerBottom + 48,
    head: [[
      t('documents.receipt.description'),
      t('documents.receipt.qty'),
      t('documents.receipt.unitPrice', { currency }),
      t('documents.receipt.lineTotal', { currency }),
    ]],
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

  // Récapitulatif
  const label = (text: string) => `${text} :`;
  let y = (doc as any).lastAutoTable.finalY + 10;
  y = drawSummaryLine(doc, label(t('documents.receipt.subtotal')), formatPrice(order.subtotal), y);

  if (order.discount_amount > 0) {
    y = drawSummaryLine(doc, label(t('documents.receipt.discount')), `- ${formatPrice(order.discount_amount)}`, y, { color: [231, 76, 60] });
  }
  if (Number(order.takeaway_fee) > 0) {
    y = drawSummaryLine(doc, label(t('documents.receipt.packaging')), formatPrice(order.takeaway_fee), y);
  }
  if (Number(order.delivery_fee) > 0) {
    y = drawSummaryLine(doc, label(t('documents.receipt.delivery_fee')), formatPrice(order.delivery_fee), y);
  }

  const taxSummary = saleTaxSummary(order);
  if (taxSummary) {
    y = drawSummaryLine(doc, label(t('documents.receipt.net')), formatPrice(taxSummary.net), y);
    y = drawSummaryLine(doc, label(t('documents.receipt.vat', { rate: rateLabel(i18n, taxSummary.rate) })), formatPrice(taxSummary.tax), y);
    y = drawSummaryLine(doc, label(t('documents.receipt.gross')), formatPrice(taxSummary.totalWithTax), y);
  }
  if (Number(order.tip_amount) > 0) {
    y = drawSummaryLine(doc, label(t('documents.receipt.tip')), formatPrice(order.tip_amount), y);
  }

  doc.setLineWidth(0.5);
  doc.line(115, y - 2, 195, y - 2);
  drawSummaryLine(doc, label(isPaid ? t('documents.receipt.totalPaid') : t('documents.receipt.totalDue')), formatPrice(order.total), y + 6, {
    bold: true,
    size: 13,
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(t('documents.receipt.officialReceipt'), 105, doc.internal.pageSize.height - 10, { align: 'center' });

  // Download
  const reference = order.invoice_number ?? order.id.split('-')[0].toUpperCase();
  doc.save(`receipt_${structureName.replace(/\s+/g, '_').toLowerCase()}_${reference}.pdf`);
};

// Capture un élément du DOM tel qu'il est rendu à l'écran (styles Tailwind
// inclus) et le convertit en PDF multi-pages A4 — utilisé pour que le PDF
// téléchargé soit visuellement identique à l'aperçu HTML (Rapport Z, etc.).
// html2canvas-pro (et non html2canvas) est nécessaire : le thème Tailwind v4
// de ce projet utilise des couleurs oklch(), non supportées par le
// html2canvas classique (non maintenu depuis Tailwind v3).
export async function downloadElementAsPdf(element: HTMLElement, filename: string) {
  const { default: html2canvas } = await import('html2canvas-pro');
  const { default: jsPDF } = await import('jspdf');

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    doc.addPage();
    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  doc.save(filename);
}

export const generateQrCodesPdf = async (
  groups: { floorName: string; tables: { id: string; name: string }[] }[],
  structureId: string,
  structureName: string,
  baseUrl: string,
  cardsPerPage: number,
  labels: { scanToOrder: string; continued: (floorName: string) => string }
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
      doc.text(pageIndex > 0 ? labels.continued(group.floorName) : group.floorName, margin, margin + 6);

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
        doc.text(labels.scanToOrder, x + cellW / 2, y + 12, { align: 'center' });

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
