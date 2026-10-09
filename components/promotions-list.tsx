'use client';

import { useEffect, useState } from 'react';
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
  XCircle,
  MoreHorizontal,
  Info,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { togglePromotionStatus, deletePromotion } from '@/app/actions/promotions';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';
import { toast } from 'sonner';
import { PromotionDetailDialog } from './promotion-detail-dialog';
import { PromotionEditDialog } from './promotion-edit-dialog';
import { PageNav } from './page-nav';
import { UrlSearch, UrlSelect } from './url-filters';
import type { PageMeta } from '@/lib/pagination';
import { useRouter } from 'next/navigation';

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
}

interface PromotionsListProps {
  /** Une page de promotions, déjà filtrée par le serveur. */
  promotions: Promotion[];
  meta: PageMeta<unknown>;
  products: { id: string, name: string }[];
}

export function PromotionsList({ promotions: initialPromotions, meta, products }: PromotionsListProps) {
  const router = useRouter();
  const [promotions, setPromotions] = useState(initialPromotions);
  // Nouvelle page ou nouveaux filtres : on repart des données du serveur.
  useEffect(() => setPromotions(initialPromotions), [initialPromotions]);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { t, format } = useT();
  const dialogs = useDialogs();

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const result = await togglePromotionStatus(id, !currentStatus);
    if (result.success) {
      setPromotions(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      toast.success(!currentStatus ? t('promotions.list.activated') : t('promotions.list.deactivated'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await dialogs.confirm({ description: t('promotions.list.confirmDelete'), destructive: true }))) return;
    
    const result = await deletePromotion(id);
    if (result.success) {
      setPromotions(prev => prev.filter(p => p.id !== id));
      toast.success(t('promotions.list.deleted'));
      router.refresh();
    } else {
      toast.error(result.error || t('promotions.list.deleteError'));
    }
  };

  const formatDate = (dateString: string) => {
    return format.date(dateString, {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/50 p-3">
        <UrlSearch placeholder={t('promotions.list.search')} className="min-w-48 flex-1" />
        <UrlSelect
          param="state"
          label={t('promotions.list.allStates')}
          options={[
            { value: '', label: t('promotions.list.allStates') },
            { value: 'active', label: t('promotions.list.stateActive') },
            { value: 'inactive', label: t('promotions.list.stateInactive') },
          ]}
        />
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('promotions.list.colPromotion')}</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">{t('promotions.list.colMode')}</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('promotions.list.colValue')}</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('promotions.list.colPeriod')}</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">{t('promotions.list.colStatus')}</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">{t('promotions.list.colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {promotions.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-slate-400">{t('promotions.list.noMatch')}</td>
            </tr>
          )}
          {promotions.map((promo) => (
            <tr key={promo.id} className="group hover:bg-slate-700/20 transition-colors">
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg group-hover:scale-110 transition-transform",
                    promo.promo_mode === 'STANDARD' ? 'bg-blue-500/10 text-blue-400' :
                    promo.promo_mode === 'CODE' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-emerald-500/10 text-emerald-400'
                  )}>
                    {promo.promo_mode === 'STANDARD' ? <Tag className="w-4 h-4" /> :
                     promo.promo_mode === 'CODE' ? <KeySquare className="w-4 h-4" /> :
                     <Gift className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-50">{promo.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{promo.scope === 'ORDER' ? t('promotions.list.scopeOrder') : t('promotions.list.scopeProduct')}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-center">
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border",
                  promo.promo_mode === 'STANDARD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  promo.promo_mode === 'CODE' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                )}>
                  {t(`promotions.modeBadge.${promo.promo_mode}`)}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  {promo.promo_mode === 'BUY_X_GET_Y' ? (
                    <span className="text-sm font-medium text-emerald-400">
                      {t('promotions.list.free', { required: promo.required_qty ?? 0, free: promo.free_qty ?? 0 })}
                    </span>
                  ) : (
                    <>
                      {promo.type === 'PERCENTAGE' ? (
                        <Percent className="w-3 h-3 text-purple-400" />
                      ) : (
                        <Banknote className="w-3 h-3 text-emerald-400" />
                      )}
                      <span className="text-sm font-medium text-slate-200">
                        {promo.type === 'PERCENTAGE' ? `${format.number(promo.value)} %` : format.money(promo.value)}
                      </span>
                    </>
                  )}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>{formatDate(promo.start_date)} - {formatDate(promo.end_date)}</span>
                </div>
              </td>
              <td className="px-4 py-4 text-center">
                <button
                  onClick={() => handleToggle(promo.id, promo.is_active)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border",
                    promo.is_active 
                      ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" 
                      : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                  )}
                >
                  {promo.is_active ? t('promotions.list.active') : t('promotions.list.inactive')}
                </button>
              </td>
              <td className="px-4 py-4 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-slate-800 border-slate-700 text-slate-200">
                    <DropdownMenuLabel>{t('promotions.list.actions')}</DropdownMenuLabel>
                    <DropdownMenuItem 
                      onClick={() => { setSelectedPromo(promo); setDetailOpen(true); }}
                      className="cursor-pointer"
                    >
                      <Info className="w-4 h-4 mr-2" /> {t('promotions.list.details')}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => { setSelectedPromo(promo); setEditOpen(true); }}
                      className="cursor-pointer"
                    >
                      <Edit className="w-4 h-4 mr-2" /> {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleToggle(promo.id, promo.is_active)}
                      className="cursor-pointer text-yellow-500"
                    >
                      {promo.is_active ? <XCircle className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      {promo.is_active ? t('promotions.list.deactivate') : t('promotions.list.activate')}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(promo.id)}
                      className="cursor-pointer text-red-500 focus:text-red-400 focus:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <PageNav meta={meta} />

      {/* Dialogs */}
      <PromotionDetailDialog 
        promotion={selectedPromo} 
        open={detailOpen} 
        onOpenChange={setDetailOpen} 
      />
      
      <PromotionEditDialog 
        promotion={selectedPromo}
        products={products}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          // Re-fetch should be handled by revalidatePath in server actions
          // But since we want immediate UI update we might need a refresh or full re-fetch
          window.location.reload(); 
        }}
      />
    </div>
  );
}
