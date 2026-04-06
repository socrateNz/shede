'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { openShift, closeShift, getActiveShift } from '@/app/actions/shifts';
import { Lock, Unlock, AlertCircle, Receipt, Printer, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatFCFA } from '@/lib/utils';
import { RapportZ } from './reporting/rapport-z';

export function ShiftStatusIndicator() {
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [isReportModal, setIsReportModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [actualAmount, setActualAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [lastClosedShift, setLastClosedShift] = useState<any>(null);

  useEffect(() => {
    fetchActiveShift();
  }, []);

  async function fetchActiveShift() {
    const shift = await getActiveShift();
    setActiveShift(shift);
  }

  async function handleOpenShift() {
    setLoading(true);
    const res = await openShift(Number(openingBalance));
    if (res.success) {
      toast.success('Caisse ouverte avec succès.');
      setActiveShift(res.shift);
      setIsOpeningModal(false);
    } else {
      toast.error(res.error || "Erreur lors de l'ouverture.");
    }
    setLoading(false);
  }

  async function handleCloseShift() {
    setLoading(true);
    const res = await closeShift(Number(actualAmount), notes);
    if (res.success) {
      toast.success('Caisse clôturée avec succès.');
      setLastClosedShift(res.shift);
      setActiveShift(null);
      setIsClosingModal(false);
      setIsReportModal(true);
    } else {
      toast.error(res.error || "Erreur lors de la clôture.");
    }
    setLoading(false);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {activeShift ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClosingModal(true)}
            className="w-full bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
          >
            <Unlock className="w-4 h-4 mr-2" />
            Fermer la caisse
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpeningModal(true)}
            className="w-full bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
          >
            <Lock className="w-4 h-4 mr-2" />
            Ouvrir la caisse
          </Button>
        )}
      </div>

      {/* Opening Modal */}
      <Dialog open={isOpeningModal} onOpenChange={setIsOpeningModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-green-400" />
              Ouvrir la caisse
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Saisissez le montant initial présent dans le tiroir-caisse (fond de caisse).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Fond de caisse (FCFA)</Label>
              <Input
                id="openingBalance"
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="bg-slate-800 border-slate-700 focus:ring-blue-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpeningModal(false)}>Annuler</Button>
            <Button
              onClick={handleOpenShift}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirmer l'ouverture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Closing Modal */}
      <Dialog open={isClosingModal} onOpenChange={setIsClosingModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-400" />
              Clôturer la caisse (Rapport Z)
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Veuillez compter l'argent liquide et les autres modes de paiement présents dans la caisse.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actualAmount">Montant réel compté (FCFA)</Label>
              <Input
                id="actualAmount"
                type="number"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                placeholder="Ex: 50000"
                className="bg-slate-800 border-slate-700 focus:ring-blue-500 text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Observations</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="R.A.S"
                className="bg-slate-800 border-slate-700 focus:ring-blue-500"
              />
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 flex gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
              <p className="text-blue-200">
                L'écart de caisse sera calculé automatiquement par rapport au chiffre d'affaires théorique.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsClosingModal(false)}>Annuler</Button>
            <Button
              onClick={handleCloseShift}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              Clôturer et générer le rapport
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={isReportModal} onOpenChange={setIsReportModal}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-50 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Caisse Clôturée - Rapport Z
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            {lastClosedShift && <RapportZ shiftId={lastClosedShift.id} />}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimer le rapport
            </Button>
            <Button onClick={() => setIsReportModal(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
