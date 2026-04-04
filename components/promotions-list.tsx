'use client';

import { useState } from 'react';
import { 
  Tag, 
  Calendar, 
  Type, 
  LayoutDashboard, 
  Percent, 
  Banknote, 
  CheckCircle, 
  XCircle, 
  MoreHorizontal,
  ExternalLink,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { togglePromotionStatus } from '@/app/actions/promotions';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Promotion {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  scope: 'PRODUCT' | 'ORDER';
  product_id: string | null;
  min_order_amount: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface PromotionsListProps {
  promotions: Promotion[];
}

export function PromotionsList({ promotions: initialPromotions }: PromotionsListProps) {
  const [promotions, setPromotions] = useState(initialPromotions);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const result = await togglePromotionStatus(id, !currentStatus);
    if (result.success) {
      setPromotions(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Promotion</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type & Valeur</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Période</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Scope</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Status</th>
            <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {promotions.map((promo) => (
            <tr key={promo.id} className="group hover:bg-slate-700/20 transition-colors">
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform">
                    <Tag className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-50">{promo.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{promo.id.slice(0, 8)}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  {promo.type === 'PERCENTAGE' ? (
                    <Percent className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Banknote className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="text-sm font-medium text-slate-200">
                    {promo.value} {promo.type === 'PERCENTAGE' ? '%' : 'FCFA'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Du {formatDate(promo.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-3 h-3" />
                    <span>Au {formatDate(promo.end_date)}</span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-700/50 border border-slate-600/50">
                  <LayoutDashboard className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-tighter">
                    {promo.scope === 'ORDER' ? 'Commande' : 'Produit'}
                  </span>
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
                  {promo.is_active ? (
                    <><CheckCircle className="w-3 h-3" /> ACTIF</>
                  ) : (
                    <><XCircle className="w-3 h-3" /> INACTIF</>
                  )}
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
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/promotions/${promo.id}`} className="cursor-pointer">
                        <ExternalLink className="w-4 h-4 mr-2" /> Voir Codes Promo
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleToggle(promo.id, promo.is_active)}
                      className="cursor-pointer text-yellow-400 focus:text-yellow-300 focus:bg-yellow-400/10"
                    >
                      {promo.is_active ? <XCircle className="w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      {promo.is_active ? 'Désactiver' : 'Activer'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
