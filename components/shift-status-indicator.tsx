'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Lock, Unlock, AlertCircle, Receipt, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';
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
  const [downloadingReport, setDownloadingReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

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
      toast.success(t('analytics.register.opened'));
      setActiveShift(res.shift);
      setIsOpeningModal(false);
    } else {
      toast.error(res.error || t('analytics.register.openError'));
    }
    setLoading(false);
  }

  async function handleCloseShift() {
    setLoading(true);
    const res = await closeShift(Number(actualAmount), notes);
    if (res.success) {
      toast.success(t('analytics.register.closed'));
      setLastClosedShift(res.shift);
      setActiveShift(null);
      setIsClosingModal(false);
      setIsReportModal(true);
    } else {
      toast.error(res.error || t('analytics.register.closeError'));
    }
    setLoading(false);
  }

  async function handleDownloadReport() {
    if (!lastClosedShift || !reportRef.current) return;
    setDownloadingReport(true);
    try {
      const { downloadElementAsPdf } = await import('@/lib/pdf-utils');
      await downloadElementAsPdf(reportRef.current, `rapport-z_${lastClosedShift.id.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error('[ShiftStatusIndicator] PDF error:', error);
      toast.error(t('analytics.shifts.pdfError'));
    } finally {
      setDownloadingReport(false);
    }
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
            {t('analytics.register.close')}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpeningModal(true)}
            className="w-full bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
          >
            <Lock className="w-4 h-4 mr-2" />
            {t('analytics.register.open')}
          </Button>
        )}
      </div>

      {/* Opening Modal */}
      <Dialog open={isOpeningModal} onOpenChange={setIsOpeningModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-green-400" />
              {t('analytics.register.open')}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {t('analytics.register.openHint')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">{t('analytics.register.openingBalance')}</Label>
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
            <Button variant="ghost" onClick={() => setIsOpeningModal(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleOpenShift}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {t('analytics.register.confirmOpen')}
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
              {t('analytics.register.closeTitle')}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {t('analytics.register.closeHint')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actualAmount">{t('analytics.register.actualAmount')}</Label>
              <Input
                id="actualAmount"
                type="number"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                placeholder={t('analytics.register.actualAmountPlaceholder')}
                className="bg-slate-800 border-slate-700 focus:ring-blue-500 text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t('analytics.register.notes')}</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('analytics.register.notesPlaceholder')}
                className="bg-slate-800 border-slate-700 focus:ring-blue-500"
              />
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 flex gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
              <p className="text-blue-200">
                {t('analytics.register.differenceHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsClosingModal(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleCloseShift}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('analytics.register.confirmClose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={isReportModal} onOpenChange={setIsReportModal}>
        <DialogContent className="max-w-5xl! bg-slate-900 border-slate-800 text-slate-50 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              {t('analytics.register.closedTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            {lastClosedShift && <RapportZ shiftId={lastClosedShift.id} containerRef={reportRef} />}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDownloadReport} disabled={downloadingReport} className="gap-2">
              {downloadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloadingReport ? t('analytics.shifts.generating') : t('analytics.register.downloadReport')}
            </Button>
            <Button onClick={() => setIsReportModal(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}