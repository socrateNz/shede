import { requireRole } from '@/app/actions/auth';
import { getAllShifts } from '@/app/actions/shifts';
import { ShiftsHistoryTable } from '@/components/shifts-history-table';
import { History, BarChart3, Receipt, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function ShiftsHistoryPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const shifts = await getAllShifts(session.structureId!);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
              <History className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Audit financier</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              Historique des Sessions
            </h1>
            <p className="text-slate-400">Archives de toutes les ouvertures et clôtures de caisse</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/statistics">
              <Button variant="ghost" className="text-slate-400 hover:text-white">
                <BarChart3 className="w-4 h-4 mr-2" />
                Statistiques
              </Button>
            </Link>
          </div>
        </div>

        {/* Dashboard Grid for Sessions Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-xl group hover:border-blue-500/30 transition-all duration-300">
             <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                   <Receipt className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/50 px-2 py-1 rounded">Volume</span>
             </div>
             <p className="text-3xl font-black text-white">{shifts.length}</p>
             <p className="text-sm text-slate-500">Sessions enregistrées</p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-xl group hover:border-red-500/30 transition-all duration-300">
             <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
                   <TrendingDown className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/50 px-2 py-1 rounded">Audit</span>
             </div>
             <p className="text-3xl font-black text-red-400">
               {shifts.filter(s => Number(s.difference) < 0).length}
             </p>
             <p className="text-sm text-slate-500">Sessions avec écart négatif</p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-xl group hover:border-green-500/30 transition-all duration-300">
             <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-green-500/10 text-green-400">
                   <CheckCircle className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/50 px-2 py-1 rounded">Opérationnel</span>
             </div>
             <p className="text-3xl font-black text-green-400">
                {shifts.filter(s => s.status === 'OPEN').length}
             </p>
             <p className="text-sm text-slate-500">Session(s) actuellement ouverte(s)</p>
          </div>
        </div>

        {/* Main Content */}
        <ShiftsHistoryTable shifts={shifts} />

        {/* Footer */}
        <div className="mt-8 p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-center gap-3 text-sm text-blue-300/80">
          <History className="w-5 h-5 text-blue-400 shrink-0" />
          <p>
            Toutes les données de session sont sécurisées et ne peuvent pas être modifiées après clôture.
          </p>
        </div>
      </div>
    </div>
  );
}

// Small icon helpers since lucide imports might fail if not careful
function TrendingDown(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
}

function CheckCircle(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
}

