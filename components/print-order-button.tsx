'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { generateOrderReceipt } from '@/lib/pdf-utils';

interface PrintOrderButtonProps {
  order: any;
}

export function PrintOrderButton({ order }: PrintOrderButtonProps) {
  const handlePrint = async () => {
    await generateOrderReceipt(order);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handlePrint}
      className="h-8 w-8 text-blue-400 hover:text-white hover:bg-slate-700 transition-all duration-200"
      title="Imprimer le ticket"
    >
      <Printer className="w-4 h-4" />
    </Button>
  );
}
