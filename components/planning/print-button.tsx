'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="border-slate-600 text-slate-200 hover:bg-slate-700 print:hidden">
      <Printer className="mr-2 h-4 w-4" /> {label}
    </Button>
  );
}
