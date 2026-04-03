'use client';

import dynamic from 'next/dynamic';

// Disable SSR completely for this component so it never runs jspdf on the server
const DownloadInvoiceButton = dynamic(
  () => import('./download-invoice-button').then((mod) => mod.DownloadInvoiceButton),
  { ssr: false }
);

export function ClientInvoiceWrapper({ order }: { order: any }) {
  return <DownloadInvoiceButton order={order} />;
}
