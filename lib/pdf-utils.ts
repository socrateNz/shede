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
  total: number;
  table_number?: number | null;
  rooms?: { number: string } | null;
  created_at: string;
}) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const date = format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: fr });

  // Header
  doc.setFontSize(22);
  doc.setTextColor(40, 44, 52);
  doc.text('TICKET DE CAISSE', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`N° Commande : ${order.id.toUpperCase().slice(0, 8)}`, 15, 35);
  doc.text(`Date : ${date}`, 15, 40);

  // Source Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const source = order.rooms?.number 
    ? `Chambre ${order.rooms.number}` 
    : order.table_number 
      ? `Table ${order.table_number}` 
      : 'À emporter';
  doc.text(`Source : ${source}`, 15, 55);

  // Table (Simple summary for now as getOrders doesn't fetch items in the main list)
  autoTable(doc, {
    startY: 65,
    head: [['Description', 'Total (FCFA)']],
    body: [
      ['Consommation Restaurant', `${order.total.toLocaleString()}`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [40, 44, 52], fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 150 },
      1: { cellWidth: 40, halign: 'right' }
    }
  });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL PAYÉ :  ${order.total.toLocaleString()} FCFA`, 195, finalY, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Merci de votre visite au restaurant !', 105, 285, { align: 'center' });

  // Download
  doc.save(`ticket_${order.id.slice(0, 8)}.pdf`);
};
