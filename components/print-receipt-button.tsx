'use client';

import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { toast } from 'sonner';

interface PrintReceiptButtonProps {
  booking: any;
  variant?: 'button' | 'dropdown';
}

export function PrintReceiptButton({ booking, variant = 'dropdown' }: PrintReceiptButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (isPrinting) return;

    setIsPrinting(true);

    try {
      // Import dynamique pour éviter les erreurs SSR
      const { generateBookingReceipt } = await import('@/lib/pdf-utils');
      await generateBookingReceipt(booking);
      toast.success('Reçu généré avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'impression:', error);
      toast.error('Erreur lors de la génération du reçu');
    } finally {
      setIsPrinting(false);
    }
  };

  if (variant === 'button') {
    return (
      <Button
        onClick={handlePrint}
        disabled={isPrinting}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {isPrinting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Génération...</span>
          </>
        ) : (
          <>
            <Printer className="w-4 h-4" />
            <span>Imprimer le reçu</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenuItem
      onClick={handlePrint}
      disabled={isPrinting}
      className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 flex items-center gap-2 text-blue-400 font-medium"
    >
      {isPrinting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Génération...</span>
        </>
      ) : (
        <>
          <Printer className="w-4 h-4" />
          <span>Imprimer le reçu</span>
        </>
      )}
    </DropdownMenuItem>
  );
}