'use client';

import { 
  Dialog as UIDialog, 
  DialogContent as UIDialogContent, 
  DialogHeader as UIDialogHeader, 
  DialogTitle as UIDialogTitle 
} from "@/components/ui/dialog";
import { PromotionFormClient } from "@/app/(main)/promotions/new/promotion-form-client";

interface Product {
  id: string;
  name: string;
}

export function PromotionEditDialog({ 
  promotion, 
  products,
  open, 
  onOpenChange,
  onSuccess
}: { 
  promotion: any | null, 
  products: Product[],
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  onSuccess: () => void
}) {
  if (!promotion) return null;

  return (
    <UIDialog open={open} onOpenChange={onOpenChange}>
      <UIDialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-4xl max-h-[90vh] overflow-y-auto">
        <UIDialogHeader>
          <UIDialogTitle className="text-2xl font-bold">Modifier la Promotion</UIDialogTitle>
        </UIDialogHeader>
        
        <div className="py-6">
          <PromotionFormClient 
            products={products} 
            initialData={promotion} 
            onSuccess={() => {
              onSuccess();
              onOpenChange(false);
            }} 
          />
        </div>
      </UIDialogContent>
    </UIDialog>
  );
}
