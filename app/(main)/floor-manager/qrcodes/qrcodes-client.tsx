'use client';

import { Download, Loader2, LayoutGrid } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Floor } from '@/lib/supabase';

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

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const groups = floors
    .map((floor) => ({
      floor,
      tables: tables.filter((t) =>
        t.floor_id === floor.id || (!t.floor_id && t.floor_name === floor.name)
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
        cardsPerPage
      );
    } catch (error) {
      console.error('Erreur lors du téléchargement des QR codes:', error);
      toast.error('Erreur lors de la génération du PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="max-w-5xl mx-auto mb-8 flex flex-wrap items-center justify-end gap-4 print:hidden -mt-16">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <LayoutGrid className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-600">Grille d'impression :</span>
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
                {n}/page
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
          {downloading ? 'Génération...' : 'Télécharger (PDF)'}
        </button>
      </div>

      <div className="max-w-5xl mx-auto space-y-12 print:space-y-0">
        {pages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className={pageIndex < pages.length - 1 ? 'print:break-after-page' : ''}
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-200 print:border-slate-400">
              {page.floorName}{page.isContinuation ? ' (suite)' : ''}
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
                    <p className="text-xs text-slate-500 mb-4">Scannez pour commander</p>

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
                      <span className="text-sm font-semibold text-slate-700">Table</span>
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
          Aucune table n'a été créée pour cet établissement.
        </div>
      )}
    </>
  );
}
