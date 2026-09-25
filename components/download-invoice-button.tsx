'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { generateOrderReceipt } from '@/lib/pdf-utils';
import { useT } from '@/lib/i18n/client';

export function DownloadInvoiceButton({ order }: { order: any }) {
  const [loading, setLoading] = useState(false);
  const i18n = useT();
  const { t } = i18n;

  const handleDownload = async () => {
    try {
      setLoading(true);
      await generateOrderReceipt(order, i18n);
    } catch (e) {
      console.error('Erreur lors du téléchargement de la facture:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      title={t('client.invoice.download')}
      aria-label={t('client.invoice.download')}
      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
    >
      <Download className={`w-4 h-4 ${loading ? 'animate-pulse text-blue-500' : ''}`} />
    </button>
  );
}

