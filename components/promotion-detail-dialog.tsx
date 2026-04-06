'use client';

import { 
  Dialog as UIDialog, 
  DialogContent as UIDialogContent, 
  DialogHeader as UIDialogHeader, 
  DialogTitle as UIDialogTitle 
} from "@/components/ui/dialog";
import { 
  Tag, 
  Calendar, 
  Percent, 
  Banknote, 
  ShoppingBag, 
  Gift, 
  KeySquare,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

interface Promotion {
  id: string;
  name: string;
  promo_mode: 'STANDARD' | 'CODE' | 'BUY_X_GET_Y';
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  scope: 'PRODUCT' | 'ORDER';
  product_id: string | null;
  min_order_amount: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  code_name?: string;
  usage_limit?: number;
  used_count?: number;
  required_qty?: number;
  free_qty?: number;
  is_cumulative?: boolean;
  products?: { name: string };
}

export function PromotionDetailDialog({ 
  promotion, 
  open, 
  onOpenChange 
}: { 
  promotion: Promotion | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void 
}) {
  if (!promotion) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <UIDialog open={open} onOpenChange={onOpenChange}>
      <UIDialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
        <UIDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${
              promotion.promo_mode === 'STANDARD' ? 'bg-blue-500/10 text-blue-400' :
              promotion.promo_mode === 'CODE' ? 'bg-purple-500/10 text-purple-400' :
              'bg-emerald-500/10 text-emerald-400'
            }`}>
              {promotion.promo_mode === 'STANDARD' ? <Tag className="w-5 h-5" /> :
               promotion.promo_mode === 'CODE' ? <KeySquare className="w-5 h-5" /> :
               <Gift className="w-5 h-5" />}
            </div>
            <div>
              <UIDialogTitle className="text-xl font-bold">{promotion.name}</UIDialogTitle>
              <p className="text-xs text-slate-500 font-mono">ID: {promotion.id}</p>
            </div>
          </div>
        </UIDialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 font-medium">Statut actuel</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
              promotion.is_active 
                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {promotion.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {promotion.is_active ? 'ACTIF' : 'INACTIF'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Mode specific info */}
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Type d'offre</p>
              <p className="text-sm font-semibold flex items-center gap-2">
                {promotion.promo_mode === 'STANDARD' ? 'Automatique' :
                 promotion.promo_mode === 'CODE' ? `Code: ${promotion.code_name}` :
                 'Cadeau (Buy X Get Y)'}
              </p>
            </div>

            <div className="space-y-1 text-right">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Valeur</p>
              <div className="text-sm font-bold text-blue-400 flex items-center justify-end gap-1">
                {promotion.promo_mode === 'BUY_X_GET_Y' ? (
                  <span>{promotion.required_qty} + {promotion.free_qty} offerts</span>
                ) : (
                  <>
                    {promotion.type === 'PERCENTAGE' ? <Percent className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                    {promotion.value} {promotion.type === 'PERCENTAGE' ? '%' : 'FCFA'}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
             <div className="flex items-start gap-3">
                <ShoppingBag className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                   <p className="text-xs font-semibold text-slate-300">Portée et Restriction</p>
                   <p className="text-sm text-slate-400">
                      {promotion.scope === 'ORDER' ? 'Toute la commande' : `Uniquement sur : ${promotion.products?.name || 'Produit spécifique'}`}
                      {promotion.min_order_amount > 0 && ` (Min: ${formatFCFA(promotion.min_order_amount)})`}
                   </p>
                </div>
             </div>

             <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                <div className="grid grid-cols-1 gap-2">
                   <div>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Début</p>
                     <p className="text-sm text-slate-300">{formatDate(promotion.start_date)}</p>
                   </div>
                   <div>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fin</p>
                     <p className="text-sm text-slate-300">{formatDate(promotion.end_date)}</p>
                   </div>
                </div>
             </div>

             {promotion.promo_mode === 'CODE' && (
                <div className="flex items-center justify-between p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 italic">
                   <div className="text-xs text-blue-400">
                      Utilisations : <span className="font-bold">{promotion.used_count || 0}</span> / {promotion.usage_limit || '∞'}
                   </div>
                </div>
             )}
          </div>
        </div>
      </UIDialogContent>
    </UIDialog>
  );
}
