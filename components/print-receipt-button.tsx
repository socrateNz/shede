'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { generateBookingReceipt } from '@/lib/pdf-utils';

interface PrintReceiptButtonProps {
  booking: any;
}

export function PrintReceiptButton({ booking }: PrintReceiptButtonProps) {
  const handlePrint = () => {
    generateBookingReceipt(booking);
  };

  return (
    <DropdownMenuItem 
      onClick={handlePrint}
      className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 flex items-center gap-2 text-blue-400 font-medium"
    >
      <Printer className="w-4 h-4" />
      <span>Imprimer le reçu</span>
    </DropdownMenuItem>
  );
}
