import {
  documentCurrency,
  formatDocumentAmount,
  saleTaxSummary,
  initialsOf,
  ticketDetails,
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

// ── Tickets 80 mm ─────────────────────────────────────────
// Même format que le ticket de caisse thermique : 80 mm de large, hauteur selon le contenu,
// police à chasse fixe, séparateurs en pointillés. Imprimable tel quel sur une imprimante
// thermique 80 mm (zone utile ≈ 72 mm).

const TICKET_WIDTH = 80;
const TICKET_MARGIN = 4;
const TICKET_RIGHT = TICKET_WIDTH - TICKET_MARGIN;
const TICKET_CONTENT = TICKET_WIDTH - TICKET_MARGIN * 2;
const PT_TO_MM = 0.3528;

type TextOptions = { size?: number; bold?: boolean };

/** Écriture ligne à ligne sur un ticket ; `y` avance au fil du contenu. */
class TicketWriter {
  y = TICKET_MARGIN + 2;

  constructor(private doc: JsPdf) {}

  private font({ size = 8, bold = false }: TextOptions) {
    this.doc.setFont('courier', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(0);
    return size * PT_TO_MM * 1.25; // hauteur de ligne (mm)
  }

  private lines(text: string, width: number) {
    return this.doc.splitTextToSize(pdfText(text), width) as string[];
  }

  center(text: string, options: TextOptions = {}) {
    const height = this.font(options);
    for (const line of this.lines(text, TICKET_CONTENT)) {
      this.y += height;
      this.doc.text(line, TICKET_WIDTH / 2, this.y, { align: 'center' });
    }
  }

  left(text: string, options: TextOptions & { indent?: number } = {}) {
    const height = this.font(options);
    const indent = options.indent ?? 0;
    for (const line of this.lines(text, TICKET_CONTENT - indent)) {
      this.y += height;
      this.doc.text(line, TICKET_MARGIN + indent, this.y);
    }
  }

  /** Libellé à gauche (renvoyé à la ligne si besoin), montant aligné à droite sur la 1re ligne. */
  row(label: string, value: string, options: TextOptions & { indent?: number } = {}) {
    const height = this.font(options);
    const indent = options.indent ?? 0;
    const valueText = pdfText(value);
    const valueWidth = value ? this.doc.getTextWidth(valueText) + 2 : 0;
    const lines = this.lines(label, TICKET_CONTENT - indent - valueWidth);
    lines.forEach((line, i) => {
      this.y += height;
      this.doc.text(line, TICKET_MARGIN + indent, this.y);
      if (i === 0 && value) this.doc.text(valueText, TICKET_RIGHT, this.y, { align: 'right' });
    });
  }

  gap(mm = 1.5) {
    this.y += mm;
  }

  /**
   * En-tête en deux colonnes : logo à gauche (ou initiales dans un carré), nom et
   * coordonnées à droite, justifiés à droite. La hauteur suit la plus haute des deux.
   */
  headerColumns(logo: TicketLogo | null, initials: string, name: string, details: string[]) {
    const top = this.y + 1;
    let left: number;
    if (logo) {
      const ratio = Math.min(LOGO_MAX_WIDTH / logo.width, LOGO_MAX_HEIGHT / logo.height);
      const width = logo.width * ratio;
      const height = logo.height * ratio;
      this.doc.addImage(logo.dataUrl, 'PNG', TICKET_MARGIN, top, width, height);
      left = TICKET_MARGIN + width;
      this.logoBottom = top + height;
    } else {
      const size = 16;
      this.doc.setDrawColor(0);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(TICKET_MARGIN, top, size, size, 2, 2);
      this.font({ size: initials.length > 2 ? 11 : 14, bold: true });
      this.doc.text(initials, TICKET_MARGIN + size / 2, top + size / 2, { align: 'center', baseline: 'middle' });
      left = TICKET_MARGIN + size;
      this.logoBottom = top + size;
    }

    // Colonne de droite, justifiée à droite
    const width = TICKET_RIGHT - (left + 3);
    let y = top;
    const write = (text: string, options: TextOptions) => {
      const height = this.font(options);
      for (const line of this.lines(text, width)) {
        y += height;
        this.doc.text(line, TICKET_RIGHT, y, { align: 'right' });
      }
    };
    write(name, { size: 10, bold: true });
    y += 0.8;
    for (const detail of details) write(detail, { size: 6.5 });
    this.y = Math.max(y, this.logoBottom) + 0.5;
  }

  private logoBottom = 0;

  /** Double trait : sépare l'en-tête de l'établissement du contenu du ticket. */
  doubleRule() {
    this.y += 2.5;
    this.doc.setDrawColor(0);
    this.doc.setLineDashPattern([], 0);
    this.doc.setLineWidth(0.5);
    this.doc.line(TICKET_MARGIN, this.y, TICKET_RIGHT, this.y);
    this.doc.setLineWidth(0.2);
    this.doc.line(TICKET_MARGIN, this.y + 0.9, TICKET_RIGHT, this.y + 0.9);
    this.y += 1.5;
  }

  separator(style: 'dashed' | 'solid' = 'dashed') {
    this.y += 2;
    this.doc.setDrawColor(0);
    this.doc.setLineWidth(style === 'solid' ? 0.3 : 0.2);
    if (style === 'dashed') this.doc.setLineDashPattern([0.8, 0.8], 0);
    this.doc.line(TICKET_MARGIN, this.y, TICKET_RIGHT, this.y);
    this.doc.setLineDashPattern([], 0);
    this.y += 0.5;
  }
}

type TicketLogo = { dataUrl: string; width: number; height: number };

const LOGO_MAX_WIDTH = 24; // mm
const LOGO_MAX_HEIGHT = 22; // mm
const LOGO_TIMEOUT_MS = 4000;

/**
 * Logo prêt pour le ticket : fond blanc (les PNG transparents s'impriment en noir sinon),
 * niveaux de gris (imprimante thermique), PNG. null si absent ou impossible à charger.
 */
async function loadTicketLogo(url: string | null | undefined): Promise<TicketLogo | null> {
  if (!url || typeof window === 'undefined') return null;
  // 4 s au plus : un hébergeur de logo lent ne doit jamais bloquer l'impression du ticket
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGO_TIMEOUT_MS);
  let objectUrl: string | null = null;
  try {
    // fetch CORS sans cache : une copie déjà chargée par un <img> sans CORS (ticket thermique)
    // serait refusée par le canvas ; on lit l'image en blob puis on la décode localement.
    const response = await fetch(url, { mode: 'cors', cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    objectUrl = URL.createObjectURL(await response.blob());
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo'));
      controller.signal.addEventListener('abort', () => reject(new Error('timeout')));
      img.src = objectUrl!;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    // Rendu à ~8 px/mm (≈ 200 dpi), largement suffisant pour une imprimante thermique
    const scale = Math.min((LOGO_MAX_WIDTH * 8) / img.naturalWidth, (LOGO_MAX_HEIGHT * 8) / img.naturalHeight, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'grayscale(1) contrast(1.15)';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } catch {
    return null; // logo inaccessible ou trop lent : le ticket sort quand même, avec les initiales
  } finally {
    clearTimeout(timer);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * En-tête : logo à gauche (initiales s'il n'y en a pas), nom, adresse, contact et
 * NIU / RCCM à droite, puis un double trait avant le contenu du ticket.
 */
function ticketHeader(
  w: TicketWriter,
  i18n: DocumentI18n,
  structure: DocumentStructure | null | undefined,
  fallbackName: string,
  logo: TicketLogo | null
) {
  const name = structure?.name || fallbackName;
  w.headerColumns(logo, initialsOf(name), name.toUpperCase(), ticketDetails(structure, i18n.t));
  w.doubleRule();
}

/**
 * Dessine le ticket deux fois : une première passe mesure la hauteur, la seconde
 * l'écrit sur une page de 80 mm × hauteur exacte, puis le PDF est téléchargé.
 */
async function saveTicket(draw: (w: TicketWriter) => void, filename: string) {
  const { default: jsPDF } = await import('jspdf');
  const measure = new TicketWriter(new jsPDF({ unit: 'mm', format: [TICKET_WIDTH, 3000] }));
  draw(measure);
  const height = Math.max(Math.ceil(measure.y + TICKET_MARGIN + 2), 60);
  const doc = new jsPDF({ unit: 'mm', format: [TICKET_WIDTH, height], orientation: 'portrait' });
  draw(new TicketWriter(doc));
  doc.save(filename);
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
  const structure = booking.rooms?.structures;
  const currency = documentCurrency(structure);
  const money = (value: number | null | undefined) => formatDocumentAmount(value, currency, format.intl);
  const roomLabel = booking.rooms?.number ?? booking.rooms?.name ?? '';
  const taxSummary = saleTaxSummary(booking);
  const issuedAt = format.dateTime(new Date());
  const logo = await loadTicketLogo(structure?.logo_url);

  await saveTicket((w) => {
    ticketHeader(w, i18n, structure, 'Shede', logo);
    w.gap(0.5);
    w.center(
      booking.invoice_number ? t('documents.receipt.invoiceTitle', { number: booking.invoice_number }) : t('documents.booking.title'),
      { size: 9, bold: true }
    );
    w.center(t('documents.booking.reference', { ref: booking.id.toUpperCase().slice(0, 8) }));
    w.center(t('documents.booking.date', { date: issuedAt }));
    w.center(t('documents.receipt.status', { status: booking.is_paid ? t('documents.receipt.paid') : t('documents.receipt.unpaid') }), { bold: true });

    w.separator();
    w.row(t('documents.booking.client'), booking.guest_name || t('documents.booking.walkIn'));

    w.separator();
    w.row(t('documents.booking.room', { number: roomLabel }), money(booking.total_amount || 0), { bold: true });
    w.left(t('documents.booking.dates', { from: format.date(booking.check_in), to: format.date(booking.check_out) }), { size: 7, indent: 2 });
    w.left(`${t('documents.booking.unitPrice')} : ${money(booking.rooms?.price || 0)}`, { size: 7, indent: 2 });

    w.separator();
    if (taxSummary) {
      w.row(`${t('documents.receipt.net')} :`, money(taxSummary.net));
      w.row(`${t('documents.receipt.vat', { rate: rateLabel(i18n, taxSummary.rate) })} :`, money(taxSummary.tax));
    }
    w.separator('solid');
    w.row(`${booking.is_paid ? t('documents.receipt.totalPaid') : t('documents.receipt.totalDue')} :`, money(booking.total_amount || 0), {
      size: 10,
      bold: true,
    });

    w.gap(6);
    w.left(t('documents.booking.stamp'), { size: 7 });
    w.gap(10);
    w.separator();
    w.center(t('documents.booking.thanks'));
    w.center(t('documents.receipt.generatedBy'), { size: 6.5 });
  }, `receipt_${booking.invoice_number ?? booking.id.slice(0, 8)}.pdf`);
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
    phone?: string | null;
    invoice_number?: string | null;
    paid_at?: string | null;
    table_number?: number | null;
    tables?: { name?: string | null } | null;
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
  const date = format.dateTime(order.paid_at || order.created_at);
  const structureName = order.structures?.name || 'SHEDE SYSTEM';
  const currency = documentCurrency(order.structures);
  const money = (num: number | null | undefined) => formatDocumentAmount(num, currency, format.intl);
  const isPaid = order.status === 'COMPLETED';
  const taxSummary = saleTaxSummary(order);
  const table = order.tables?.name || (order.table_number ? String(order.table_number) : null);
  const place =
    order.consumption_type === 'DELIVERY'
      ? t('documents.receipt.delivery', { address: [order.delivery_district, order.delivery_city].filter(Boolean).join(', ') })
      : order.rooms?.number
        ? t('documents.receipt.room', { room: order.rooms.number })
        : table
          ? /^\d+$/.test(table)
            ? t('documents.receipt.table', { table })
            : table // nom saisi à la création (« Table 3 », « Terrasse 2 »…)
          : t('documents.receipt.takeaway');

  const logo = await loadTicketLogo(order.structures?.logo_url);

  await saveTicket((w) => {
    ticketHeader(w, i18n, order.structures, 'SHEDE SYSTEM', logo);
    w.gap(0.5);
    w.center(
      isPaid && order.invoice_number ? t('documents.receipt.invoiceTitle', { number: order.invoice_number }) : t('documents.receipt.orderReceipt'),
      { size: 9, bold: true }
    );
    w.center(t('documents.receipt.orderNumber', { number: order.id.split('-')[0].toUpperCase() }));
    w.center(date);
    w.center(t('documents.receipt.status', { status: isPaid ? t('documents.receipt.paid') : t('documents.receipt.unpaid') }), { bold: true });

    w.separator();
    w.left(place, { bold: true });
    if (order.consumption_type === 'DELIVERY') {
      if (order.delivery_landmark) w.left(t('documents.receipt.landmark', { landmark: order.delivery_landmark }), { size: 7 });
      if (order.phone) w.left(t('documents.receipt.phoneLine', { phone: order.phone }), { size: 7 });
    }

    w.separator();
    w.row(`${t('documents.receipt.qty')}  ${t('documents.receipt.item')}`, t('documents.receipt.price'), { size: 7 });
    w.gap(0.5);
    for (const item of order.order_items ?? []) {
      if (!(item.total_price > 0 || item.unit_price > 0)) continue;
      // Lot promotionnel (X achetés, Y offerts) : unités payées puis unités offertes
      // Lot « X achetés, Y offerts » seulement si le montant correspond à des unités entières ;
      // sinon (ligne remisée, ex. marketplace) on affiche le montant réel de la ligne.
      const expectedTotal = item.quantity * item.unit_price;
      const paidUnits = item.unit_price > 0 ? Math.round(item.total_price / item.unit_price) : 0;
      const isFreeUnitsBundle =
        expectedTotal > item.total_price && item.total_price > 0 && paidUnits > 0 && paidUnits < item.quantity && paidUnits * item.unit_price === item.total_price;
      if (isFreeUnitsBundle) {
        w.row(`${paidUnits} x ${item.products.name}`, money(paidUnits * item.unit_price));
        w.row(`${item.quantity - paidUnits} x ${t('documents.receipt.promo', { name: item.products.name })}`, t('documents.receipt.free'));
      } else if (item.total_price === 0 && item.quantity > 0) {
        w.row(`${item.quantity} x ${t('documents.receipt.offered', { name: item.products.name })}`, money(0));
      } else {
        w.row(`${item.quantity} x ${item.products.name}`, money(item.total_price));
        if (item.quantity > 1) w.left(`@ ${money(item.unit_price)}`, { size: 7, indent: 4 });
      }
      for (const acc of (order.order_accompaniments ?? []).filter((a) => a.parent_order_item_id === item.id)) {
        const accName = acc.accompaniments?.name || t('documents.receipt.accompaniment');
        w.row(`+ ${acc.quantity} x ${accName}`, acc.total_price_snapshot > 0 ? money(acc.total_price_snapshot) : '', { size: 7, indent: 2 });
      }
    }

    w.separator();
    w.row(`${t('documents.receipt.subtotal')} :`, money(order.subtotal));
    if (order.discount_amount > 0) w.row(`${t('documents.receipt.discount')} :`, `- ${money(order.discount_amount)}`);
    if (Number(order.takeaway_fee) > 0) w.row(`${t('documents.receipt.packaging')} :`, money(order.takeaway_fee));
    if (Number(order.delivery_fee) > 0) w.row(`${t('documents.receipt.delivery_fee')} :`, money(order.delivery_fee));
    if (taxSummary) {
      w.row(`${t('documents.receipt.net')} :`, money(taxSummary.net));
      w.row(`${t('documents.receipt.vat', { rate: rateLabel(i18n, taxSummary.rate) })} :`, money(taxSummary.tax));
      w.row(`${t('documents.receipt.gross')} :`, money(taxSummary.totalWithTax));
    }
    if (Number(order.tip_amount) > 0) w.row(`${t('documents.receipt.tip')} :`, money(order.tip_amount));

    w.separator('solid');
    w.row(`${isPaid ? t('documents.receipt.totalPaid') : t('documents.receipt.totalDue')} :`, money(order.total), { size: 10, bold: true });

    w.separator();
    w.center(t('documents.receipt.thanks'));
    w.center(t('documents.receipt.generatedBy'), { size: 6.5 });
  }, `receipt_${structureName.replace(/\s+/g, '_').toLowerCase()}_${order.invoice_number ?? order.id.split('-')[0].toUpperCase()}.pdf`);
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
