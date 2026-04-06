'use client';

import { useEffect, useState } from 'react';
import { getShiftReport } from '@/app/actions/shifts';
import { formatFCFA } from '@/lib/utils';
import {
  Receipt,
  Calendar,
  User,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  ChefHat,
  Hotel,
  AlertCircle,
  Building2,
  Clock
} from 'lucide-react';

interface Props {
  shiftId: string;
}

export function RapportZ({ shiftId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getShiftReport(shiftId);
      setData(res);
      setLoading(false);
    }
    load();
  }, [shiftId]);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p>Génération du rapport A4...</p>
      </div>
    );
  }

  if (!data?.shift) return <div>Erreur de chargement du rapport.</div>;

  const { shift, orders, bookings, paymentMethods } = data;
  const isPositiveEcart = Number(shift.difference) > 0;
  const isNegativeEcart = Number(shift.difference) < 0;

  return (
    <div className="bg-slate-100/50 p-4 min-h-screen print:p-0 print:bg-white transition-all duration-300">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 15mm;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
           @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <div
        id="print-area"
        className="mx-auto bg-white shadow-2xl rounded-none w-full max-w-[210mm] min-h-[297mm] p-[10mm] md:p-[20mm] text-slate-900 border border-slate-200 print:border-0"
      >
        {/* Company Header */}
        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-lg font-black text-2xl">
                {shift.structures?.name?.charAt(0) || 'S'}
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{shift.structures?.name}</h1>
                <p className="text-slate-500 font-bold tracking-widest text-xs mt-1">ÉTABLISSEMENT {shift.structures?.name?.toUpperCase()}</p>
              </div>
            </div>
            <div className="text-sm space-y-1 text-slate-600 font-medium">
              <p className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {shift.structures?.address || 'Adresse non spécifiée'}</p>
              <p className="flex items-center gap-2"><Wallet className="w-4 h-4" /> Tél: {shift.structures?.phone || 'N/A'}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-slate-900 text-white px-4 py-2 font-black text-xl mb-2">RAPPORT Z</div>
            <p className="text-xs font-bold text-slate-400">SESSION #{shift.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs font-bold text-slate-400 mt-1">{new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        {/* Audit Details */}
        <div className="grid grid-cols-2 gap-16 mb-10">
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-l-4 border-blue-500 pl-3">Responsable de Session</h3>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">Caissier :</span>
                <span className="font-bold truncate">{shift.users?.first_name} {shift.users?.last_name}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">Ouverture :</span>
                <span className="font-bold">{new Date(shift.opened_at).toLocaleString('fr-FR')}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">Fermeture :</span>
                <span className="font-bold">{shift.closed_at ? new Date(shift.closed_at).toLocaleString('fr-FR') : 'NON CLÔTURÉ'}</span>
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-l-4 border-green-500 pl-3">Résumé des Flux</h3>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">Fond de caisse :</span>
                <span className="font-bold text-blue-600">{formatFCFA(shift.opening_balance)}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">Ventes Totales :</span>
                <span className="font-bold text-green-600">{formatFCFA(Number(shift.expected_amount) - Number(shift.opening_balance))}</span>
              </p>
              <p className="flex justify-between items-center border-b pb-1">
                <span className="text-slate-500 font-medium whitespace-nowrap mr-4">Argent Attendu :</span>
                <span className="font-bold underline">{formatFCFA(shift.expected_amount)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* The Big Number: Difference */}
        <div className={`p-6 mb-10 rounded-none border-2 border-slate-900 flex justify-between items-center ${isNegativeEcart ? 'bg-red-50' : 'bg-green-50'}`}>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Total Réel Compté en Caisse</h2>
            <p className="text-4xl font-black text-slate-900 mt-1">{formatFCFA(shift.actual_amount)}</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 opacity-60">Écart de Caisse</h2>
            <p className={`text-4xl font-black ${isNegativeEcart ? 'text-red-600' : isPositiveEcart ? 'text-green-600' : 'text-blue-600'}`}>
              {shift.difference > 0 ? '+' : ''}{formatFCFA(shift.difference)}
            </p>
          </div>
        </div>

        {/* DETAILED LOGS: RESTAURANT */}
        <div className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 bg-slate-100 p-2 border-l-4 border-orange-500 flex items-center gap-2">
            <ChefHat className="w-4 h-4" /> Ventes Restaurant (Détails)
          </h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase text-slate-500">
                <th className="py-2">Ref</th>
                <th className="py-2">Désignation</th>
                <th className="py-2">Heure</th>
                <th className="py-2">Table / Client</th>
                <th className="py-2 text-right">Payé (Session)</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {orders.length > 0 ? orders.map((o: any) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-2 font-bold text-slate-400">#{o.id.slice(0, 6)}</td>
                  <td className="py-2 font-black text-[10px]">
                    {o.order_items?.length > 0
                      ? o.order_items.map((item: any) => `${item.quantity}x ${item.products?.name}`).join(', ')
                      : 'Commande Directe'}
                  </td>
                  <td className="py-2 font-medium">{new Date(o.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-2 text-blue-600 font-bold">
                    {o.rooms?.number ? `Chambre ${o.rooms.number}` : o.table_number ? `Table ${o.table_number}` : o.guest_name || 'Comptoir'}
                  </td>
                  <td className="py-2 text-right font-black">{formatFCFA(o.total)}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-8 text-center italic text-slate-400">Aucune commande restaurant pendant cette session.</td></tr>
              )}
            </tbody>
            {orders.length > 0 && (
              <tfoot>
                <tr className="font-black text-sm bg-slate-900 text-white">
                  <td colSpan={4} className="py-2 px-3">SOUS-TOTAL RESTAURANT</td>
                  <td className="py-2 px-3 text-right">{formatFCFA(orders.reduce((sum: number, o: any) => sum + Number(o.total), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* DETAILED LOGS: HOTEL */}
        <div className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 bg-slate-100 p-2 border-l-4 border-blue-500 flex items-center gap-2">
            <Hotel className="w-4 h-4" /> Réservations Hôtel (Détails)
          </h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase text-slate-500">
                <th className="py-2">Ref</th>
                <th className="py-2">Désignation (Client)</th>
                <th className="py-2">Type / N°</th>
                <th className="py-2">Paiement à</th>
                <th className="py-2 text-right">Montant Payé</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {bookings.length > 0 ? bookings.map((b: any) => (
                <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-2 font-bold text-slate-400">#{b.id.slice(0, 6)}</td>
                  <td className="py-2 font-black">{b.guest_name || 'Client de passage'}</td>
                  <td className="py-2 font-medium">Ch. {b.rooms?.number} ({b.rooms?.type})</td>
                  <td className="py-2 font-medium">{new Date(b.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-2 text-right font-black">{formatFCFA(b.total_amount)}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-8 text-center italic text-slate-400">Aucune réservation hôtel pendant cette session.</td></tr>
              )}
            </tbody>
            {bookings.length > 0 && (
              <tfoot>
                <tr className="font-black text-sm bg-slate-900 text-white">
                  <td colSpan={4} className="py-2 px-3">SOUS-TOTAL HÔTEL</td>
                  <td className="py-2 px-3 text-right">{formatFCFA(bookings.reduce((sum: number, b: any) => sum + Number(b.total_amount), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 border-b pb-1">Récapitulatif des Modes de Paiement</h2>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(paymentMethods).length > 0 ? Object.entries(paymentMethods).map(([method, amount]: [string, any]) => (
              <div key={method} className="bg-slate-50 p-3 border border-slate-200">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{method}</p>
                <p className="text-lg font-black">{formatFCFA(amount)}</p>
              </div>
            )) : (
              <p className="col-span-4 text-xs italic text-slate-400">Aucune donnée de paiement détaillé détectée.</p>
            )}
          </div>
        </div>

        {/* Notes */}
        {shift.notes && (
          <div className="mb-12 p-4 border-2 border-dashed border-slate-200 bg-slate-50">
            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2 underline">Observations Générales :</h3>
            <p className="text-xs italic text-slate-600">"{shift.notes}"</p>
          </div>
        )}

        {/* Signature Area */}
        <div className="mt-auto pt-8">
          <div className="grid grid-cols-2 gap-20">
            <div className="text-center pt-8 border-t-2 border-slate-900">
              <p className="text-xs font-black uppercase tracking-widest">Visa du Caissier ({shift.users?.last_name})</p>
              <div className="h-24"></div>
            </div>
            <div className="text-center pt-8 border-t-2 border-slate-900">
              <p className="text-xs font-black uppercase tracking-widest">Visa de la Direction</p>
              <div className="h-24"></div>
            </div>
          </div>
          <div className="text-[9px] text-slate-400 text-center mt-8">
            Document généré électroniquement par Shede SaaS - Certifié conforme.
          </div>
        </div>

      </div>
    </div>
  );
}
