'use client';

import { Download, Loader2, LayoutGrid } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Floor } from '@/lib/supabase';
import { useT } from '@/lib/i18n/client';

const LAYOUT_PRESETS: Record<number, { cols: number; qrSize: number }> = {
  1: { cols: 1, qrSize: 320 },
  2: { cols: 1, qrSize: 260 },
  4: { cols: 2, qrSize: 170 },
  6: { cols: 2, qrSize: 130 },
  8: { cols: 2, qrSize: 110 },
  12: { cols: 3, qrSize: 90 },
};
const DENSITY_OPTIONS = Object.keys(LAYOUT_PRESETS).map(Number);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function QRCodesClient({
  tables,
  floors,
  structureId,
  structureName
}: {
  tables: any[];
  floors: Floor[];
  structureId: string;
  structureName: string;
}) {
  const [baseUrl, setBaseUrl] = useState('');
  const [cardsPerPage, setCardsPerPage] = useState(4);
  const [downloading, setDownloading] = useState(false);
  const { t } = useT();

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const groups = floors
    .map((floor) => ({
      floor,
      tables: tables.filter((tb) =>
        tb.floor_id === floor.id || (!tb.floor_id && tb.floor_name === floor.name)
      ),
    }))
    .filter((g) => g.tables.length > 0);

  const { cols, qrSize } = LAYOUT_PRESETS[cardsPerPage];

  // Chaque salle démarre une nouvelle page ; ses tables sont ensuite
  // paginées par lots de `cardsPerPage` pour respecter la grille choisie.
  const pages = groups.flatMap(({ floor, tables: floorTables }) =>
    chunk(floorTables, cardsPerPage).map((cards, i) => ({
      floorName: floor.name,
      isContinuation: i > 0,
      cards,
    }))
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { generateQrCodesPdf } = await import('@/lib/pdf-utils');
      await generateQrCodesPdf(
        groups.map((g) => ({ floorName: g.floor.name, tables: g.tables })),
        structureId,
        structureName,
        baseUrl,
        cardsPerPage,
        {
          scanToOrder: t('floor.qr.scanToOrder'),
          continued: (floorName) => t('floor.qr.continued', { floor: floorName }),
        }
      );
    } catch (error) {
      console.error('[QRCodesClient] PDF error:', error);
      toast.error(t('floor.qr.pdfError'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="w-full mb-8 flex flex-wrap items-center justify-end gap-4 print:hidden -mt-16">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <LayoutGrid className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-600">{t('floor.qr.grid')}</span>
          <div className="flex gap-1">
            {DENSITY_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setCardsPerPage(n)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  cardsPerPage === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t('floor.qr.perPage', { count: n })}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {downloading ? t('floor.qr.generating') : t('floor.qr.download')}
        </button>
      </div>

      <div className="w-full space-y-12 print:space-y-0">
        {pages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className={pageIndex < pages.length - 1 ? 'print:break-after-page' : ''}
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-200 print:border-slate-400">
              {page.isContinuation ? t('floor.qr.continued', { floor: page.floorName }) : page.floorName}
            </h2>
            <div
              className="grid gap-8 print:gap-4 print:p-0"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {page.cards.map((table) => {
                const tableUrl = `${baseUrl}/client/structure/${structureId}?tableId=${table.id}&tableName=${encodeURIComponent(table.name)}`;

                return (
                  <div
                    key={table.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center print:shadow-none print:border-dashed print:border-slate-400 print:break-inside-avoid"
                  >
                    <h3 className="font-bold text-slate-900 uppercase tracking-widest mb-1">{structureName}</h3>
                    <p className="text-xs text-slate-500 mb-4">{t('floor.qr.scanToOrder')}</p>

                    <div className="p-2 bg-white rounded-lg mb-4">
                      {baseUrl && (
                        <QRCodeSVG
                          value={tableUrl}
                          size={qrSize}
                          level="M"
                          includeMargin={false}
                        />
                      )}
                    </div>

                    <div className="bg-slate-100 px-4 py-2 rounded-lg w-full">
                      <span className="text-sm font-semibold text-slate-700">{t('floor.qr.table')}</span>
                      <p className="text-2xl font-black text-slate-900">{table.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          {t('floor.qr.empty')}
        </div>
      )}
    </>
  );
}
