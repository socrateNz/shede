import { getPromotions } from '@/app/actions/promotions';
import { requireRole } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tag,
  Plus,
  ShieldCheck,
  LayoutDashboard,
  Percent,
  Banknote,
  Calendar,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { PromotionsList } from '@/components/promotions-list';

async function getPromotionsStats(promotions: any[]) {
  const total = promotions.length;
  const active = promotions.filter(p => p.is_active).length;
  const percentage = promotions.filter(p => p.type === 'PERCENTAGE').length;
  const fixed = promotions.filter(p => p.type === 'FIXED').length;

  return { total, active, percentage, fixed };
}

export default async function PromotionsPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const promotions = await getPromotions();
  const stats = await getPromotionsStats(promotions);

  const admin = getAdminSupabase();
  const { data: products } = await admin
    .from('products')
    .select('id, name')
    .eq('structure_id', session.structureId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative focus:outline-none">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium lowercase tracking-wide">
                Module PROMOTION {session.role === 'ADMIN' ? 'Actif' : 'Super Admin'}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              Gestion des Promotions
            </h1>
            <p className="text-slate-400">Créez des offres, gérez vos codes promo et boostez vos ventes</p>
          </div>

          <Link href="/promotions/new">
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-105 border-none">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Promotion
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">Total Offres</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">{stats.total}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Tag className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Actives */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">Actives</p>
                <h3 className="text-3xl font-bold text-green-400 tracking-tight">{stats.active}</h3>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          {/* Pourcentages */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">Pourcentage</p>
                <h3 className="text-3xl font-bold text-purple-400 tracking-tight">{stats.percentage}</h3>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Percent className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Montant Fixe */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">Montant Fixe</p>
                <h3 className="text-3xl font-bold text-emerald-400 tracking-tight">{stats.fixed}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Banknote className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <Card className="bg-slate-800/40 backdrop-blur-md border-slate-700/50 shadow-2xl overflow-hidden rounded-2xl mb-8">
          <CardHeader className="border-b border-slate-700/50 bg-slate-800/40 px-6 py-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-50 flex items-center gap-3 text-xl font-semibold tracking-tight">
                <LayoutDashboard className="w-5 h-5 text-indigo-400" />
                Liste des Promotions
              </CardTitle>
              <div className="text-xs text-slate-500 font-mono italic">
                {promotions.length} offre(s) configurée(s)
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {promotions.length === 0 ? (
              <div className="text-center py-24 text-slate-400 relative">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700/30 flex items-center justify-center border border-slate-700/50">
                  <Tag className="w-12 h-12 opacity-20" />
                </div>
                <h3 className="text-xl font-semibold text-slate-200 mb-2">Aucune promotion</h3>
                <p className="text-sm max-w-xs mx-auto mb-8 text-slate-500 italic">
                  Attirez plus de clients en créant votre première offre de réduction.
                </p>
                <Link href="/promotions/new">
                  <Button variant="outline" className="border-slate-700 text-blue-400 hover:bg-slate-800 hover:border-blue-500/50 transition-all px-8 rounded-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une promotion
                  </Button>
                </Link>
              </div>
            ) : (
              <PromotionsList promotions={promotions} products={products || []} />
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-4 items-start mb-8 backdrop-blur-sm">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400 leading-relaxed">
            <strong className="text-blue-300 block mb-1">Comment ça marche ?</strong>
            Créez une promotion (e.g. -10% sur tout l'hôtel), puis générez un ou plusieurs <Link href="/promo-codes" className="text-blue-400 underline hover:text-blue-300">codes promo</Link> liés à cette offre. 
            Les réductions sont calculées automatiquement lors du passage en caisse ou de la réservation.
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 flex flex-col items-center gap-2 pb-8">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium">
            Shede SaaS - Promotion Logic v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
