'use client';

import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

export function QRCodesClient({ 
  tables, 
  structureId, 
  structureName 
}: { 
  tables: any[]; 
  structureId: string; 
  structureName: string;
}) {
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="max-w-5xl mx-auto mb-8 flex items-center justify-end print:hidden -mt-16">
        <button 
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Printer className="w-5 h-5" />
          Imprimer (PDF)
        </button>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 print:grid-cols-3 print:gap-4 print:p-0">
        {tables.map(table => {
          const tableUrl = `${baseUrl}/client/structure/${structureId}?table=${encodeURIComponent(table.name)}`;
          
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
                    size={140} 
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
      
      {tables.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          Aucune table n'a été créée pour cet établissement.
        </div>
      )}
    </>
  );
}
