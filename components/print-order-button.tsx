'use client';

import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { toast } from 'sonner';

interface PrintOrderButtonProps {
  order: any;
  variant?: 'button' | 'dropdown';
}

export function PrintOrderButton({ order, variant = 'button' }: PrintOrderButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (isPrinting) return;

    setIsPrinting(true);

    try {
      const { generateOrderReceipt } = await import('@/lib/pdf-utils');
      await generateOrderReceipt(order);
      toast.success('Reçu généré avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'impression:', error);
      toast.error('Erreur lors de la génération du reçu');
    } finally {
      setIsPrinting(false);
    }
  };

  if (variant === 'dropdown') {
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

  return (
    <Button
      onClick={handlePrint}
      disabled={isPrinting}
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-slate-400 hover:text-green-400 hover:bg-green-500/10 transition-all duration-200"
      title="Imprimer le reçu"
    >
      {isPrinting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Printer className="w-4 h-4" />
      )}
    </Button>
  );
}