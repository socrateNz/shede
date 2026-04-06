'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { formatFCFA } from '@/lib/utils';
import { Receipt, Eye, Calendar, User, ArrowRightLeft, Printer } from 'lucide-react';
import { RapportZ } from './reporting/rapport-z';

interface ShiftsHistoryTableProps {
  shifts: any[];
}

export function ShiftsHistoryTable({ shifts }: ShiftsHistoryTableProps) {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-300">Caissier</TableHead>
              <TableHead className="text-slate-300">Période</TableHead>
              <TableHead className="text-slate-300 text-right">Attendu</TableHead>
              <TableHead className="text-slate-300 text-right">Réel</TableHead>
              <TableHead className="text-slate-300 text-right">Écart</TableHead>
              <TableHead className="text-slate-300 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500 italic">
                  Aucune session de caisse enregistrée.
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((shift) => {
                const diff = Number(shift.difference || 0);
                return (
                  <TableRow key={shift.id} className="border-slate-700 hover:bg-slate-700/30 transition-colors">
                    <TableCell className="font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-bold">
                          {shift.users?.first_name?.charAt(0)}{shift.users?.last_name?.charAt(0)}
                        </div>
                        <div>
                          <p>{shift.users?.first_name} {shift.users?.last_name}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-tighter">#{shift.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>Du {new Date(shift.opened_at).toLocaleString('fr-FR')}</span>
                        </div>
                        {shift.closed_at && (
                          <div className="flex items-center gap-1.5 opacity-60">
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Au {new Date(shift.closed_at).toLocaleString('fr-FR')}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-slate-300 font-mono">
                      {formatFCFA(shift.expected_amount)}
                    </TableCell>
                    <TableCell className="text-right text-slate-100 font-bold font-mono">
                      {shift.status === 'CLOSED' ? formatFCFA(shift.actual_amount) : '---'}
                    </TableCell>
                    <TableCell className="text-right">
                      {shift.status === 'CLOSED' ? (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-bold",
                          diff < 0 ? "bg-red-500/10 text-red-400" : diff > 0 ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"
                        )}>
                          {diff > 0 ? '+' : ''}{formatFCFA(diff)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-yellow-500/10 text-yellow-400">
                          EN COURS
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={shift.status !== 'CLOSED'}
                        onClick={() => setSelectedShiftId(shift.id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedShiftId} onOpenChange={(open) => !open && setSelectedShiftId(null)}>
        <DialogContent className="max-w-5xl! bg-slate-900 border-slate-800 text-slate-50 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-400" />
              Archives - Rapport Z
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            {selectedShiftId && <RapportZ shiftId={selectedShiftId} />}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimer
            </Button>
            <Button onClick={() => setSelectedShiftId(null)}>Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
