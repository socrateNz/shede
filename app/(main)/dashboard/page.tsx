import Link from 'next/link';
import { requireAuth } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle,
  Building2,
  ArrowRight,
  Coffee,
  CreditCard,
  Hotel,
  Calendar,
  Bell,
  ExternalLink,
  Shield,
  ChefHat,
  Beer,
  Truck,
  BookOpen,
  Boxes,
  UserCog,
  TrendingDown,
  Ticket,
} from 'lucide-react';
import { getMyNotifications } from '@/app/actions/push';
import { getDashboardEnrichedData } from '@/app/actions/dashboard';
import { DashboardAdminCharts } from '@/components/dashboard-admin-charts';
import type { UserRole } from '@/lib/auth';

async function getDashboardStats(structureId: string, role: string, userId: string) {
  const admin = getAdminSupabase();

  if (role === 'SUPER_ADMIN') {
    const { count: structuresCount } = await admin.from('structures').select('*', { count: 'exact', head: true });
    const { count: licensesCount } = await admin.from('licenses').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const { count: allUsersCount } = await admin.from('users').select('*', { count: 'exact', head: true });
    const { count: allOrdersCount } = await admin.from('orders').select('*', { count: 'exact', head: true });
    return {
      type: 'SUPER_ADMIN',
      data: { structuresCount: structuresCount || 0, licensesCount: licensesCount || 0, allUsersCount: allUsersCount || 0, allOrdersCount: allOrdersCount || 0 },
    };
  }

  if (role === 'ADMIN' || role === 'MANAGER') {
    const { count: ordersCount } = await admin.from('orders').select('*', { count: 'exact', head: true }).eq('structure_id', structureId);
    const { count: productsCount } = await admin.from('products').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('is_deleted', false);
    const { count: usersCount } = await admin.from('users').select('*', { count: 'exact', head: true }).eq('structure_id', structureId);
    const { data: completedOrders } = await admin.from('orders').select('total').eq('structure_id', structureId).eq('status', 'COMPLETED');
    const { data: paidBookings } = await admin.from('bookings').select('total_amount, rooms!inner(structure_id)').eq('rooms.structure_id', structureId).or('status.eq.COMPLETED,is_paid.eq.true');
    const orderRevenue = (completedOrders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const hotelRevenue = (paidBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
    return {
      type: role,
      data: { ordersCount: ordersCount || 0, productsCount: productsCount || 0, usersCount: usersCount || 0, totalRevenue: orderRevenue + hotelRevenue },
    };
  }

  if (role === 'CAISSE') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: todayOrdersCount } = await admin.from('orders').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).gte('created_at', today.toISOString());
    const { count: pendingOrdersCount } = await admin.from('orders').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).in('status', ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED']);
    const { data: todayCompletedOrders } = await admin.from('orders').select('total').eq('structure_id', structureId).eq('status', 'COMPLETED').gte('updated_at', today.toISOString());
    const { data: todayPaidBookings } = await admin.from('bookings').select('total_amount, rooms!inner(structure_id)').eq('rooms.structure_id', structureId).or('status.eq.COMPLETED,is_paid.eq.true').gte('updated_at', today.toISOString());
    const todayRevenue = (todayCompletedOrders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0) + (todayPaidBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
    return { type: 'CAISSE', data: { todayOrdersCount: todayOrdersCount || 0, todayRevenue, pendingOrdersCount: pendingOrdersCount || 0 } };
  }

  if (role === 'SERVEUR') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: myActiveOrdersCount } = await admin.from('orders').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('user_id', userId).in('status', ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED']);
    const { count: myTodayCompletedCount } = await admin.from('orders').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('user_id', userId).eq('status', 'COMPLETED').gte('created_at', today.toISOString());
    return { type: 'SERVEUR', data: { myActiveOrdersCount: myActiveOrdersCount || 0, myTodayCompletedCount: myTodayCompletedCount || 0 } };
  }

  if (role === 'RECEPTION') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: todayBookingsCount } = await admin.from('bookings').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).gte('created_at', today.toISOString());
    const { count: pendingBookingsCount } = await admin.from('bookings').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('status', 'PENDING');
    const { count: totalRoomsCount } = await admin.from('rooms').select('*', { count: 'exact', head: true }).eq('structure_id', structureId);
    const { count: availableRoomsCount } = await admin.from('rooms').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('is_available', true);
    const { data: todayPaidBookings } = await admin.from('bookings').select('total_amount, rooms!inner(structure_id)').eq('rooms.structure_id', structureId).or('status.eq.COMPLETED,is_paid.eq.true').gte('updated_at', today.toISOString());
    const { data: todayCompletedOrders } = await admin.from('orders').select('total').eq('structure_id', structureId).eq('status', 'COMPLETED').gte('updated_at', today.toISOString());
    const todayRevenue = (todayPaidBookings || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) + (todayCompletedOrders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return { type: 'RECEPTION', data: { todayBookingsCount: todayBookingsCount || 0, pendingBookingsCount: pendingBookingsCount || 0, totalRoomsCount: totalRoomsCount || 0, availableRoomsCount: availableRoomsCount || 0, todayRevenue } };
  }

  if (role === 'CUISINIER') {
    const { count: pendingCount } = await admin.from('orders').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('status', 'PENDING');
    const { count: inProgressCount } = await admin.from('orders').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('status', 'IN_PROGRESS');
    return { type: 'CUISINIER', data: { pendingCount: pendingCount || 0, inProgressCount: inProgressCount || 0 } };
  }

  if (role === 'BAR') {
    const { count: activeCount } = await admin.from('orders').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).in('status', ['PENDING', 'IN_PROGRESS']);
    return { type: 'BAR', data: { activeCount: activeCount || 0 } };
  }

  if (role === 'MAGASINIER') {
    const { count: totalStock } = await admin.from('stocks').select('*', { count: 'exact', head: true }).eq('structure_id', structureId);
    return { type: 'MAGASINIER', data: { totalStock: totalStock || 0 } };
  }

  if (role === 'COMPTABLE') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: todayOrders } = await admin.from('orders').select('total').eq('structure_id', structureId).eq('status', 'COMPLETED').gte('paid_at', today.toISOString());
    const todayRevenue = (todayOrders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const { count: shiftsCount } = await admin.from('shifts').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('status', 'OPEN');
    return { type: 'COMPTABLE', data: { todayRevenue, shiftsCount: shiftsCount || 0 } };
  }

  if (role === 'RH') {
    const { count: usersCount } = await admin.from('users').select('*', { count: 'exact', head: true }).eq('structure_id', structureId).eq('is_active', true);
    return { type: 'RH', data: { usersCount: usersCount || 0 } };
  }

  return { type: 'UNKNOWN', data: {} };
}

const ROLE_CONFIG: Record<string, { label: string; Icon: any; color: string }> = {
  SUPER_ADMIN: { label: 'Super Administrateur', Icon: Shield, color: 'text-red-400 bg-red-500/10' },
  ADMIN:       { label: 'Administrateur',        Icon: Shield, color: 'text-purple-400 bg-purple-500/10' },
  MANAGER:     { label: 'Manager',               Icon: UserCog, color: 'text-indigo-400 bg-indigo-500/10' },
  CAISSE:      { label: 'Caisse',                Icon: CreditCard, color: 'text-blue-400 bg-blue-500/10' },
  SERVEUR:     { label: 'Serveur',               Icon: Coffee, color: 'text-emerald-400 bg-emerald-500/10' },
  RECEPTION:   { label: 'Réception',             Icon: Hotel, color: 'text-teal-400 bg-teal-500/10' },
  CUISINIER:   { label: 'Cuisinier',             Icon: ChefHat, color: 'text-orange-400 bg-orange-500/10' },
  BAR:         { label: 'Bar',                   Icon: Beer, color: 'text-amber-400 bg-amber-500/10' },
  LIVREUR:     { label: 'Livreur',               Icon: Truck, color: 'text-cyan-400 bg-cyan-500/10' },
  COMPTABLE:   { label: 'Comptable',             Icon: BookOpen, color: 'text-violet-400 bg-violet-500/10' },
  MAGASINIER:  { label: 'Magasinier',            Icon: Boxes, color: 'text-pink-400 bg-pink-500/10' },
  RH:          { label: 'Ressources Humaines',   Icon: Users, color: 'text-rose-400 bg-rose-500/10' },
};

function formatAmount(value: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' ' + currency;
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const role = session.role as UserRole;

  // Charger structure pour la devise
  let structure: any = null;
  if (session.structureId) {
    const admin = getAdminSupabase();
    const { data } = await admin.from('structures').select('*').eq('id', session.structureId).single();
    structure = data;
  }
  const currency = structure?.currency || 'XOF';

  const stats = await getDashboardStats(session.structureId!, role, session.userId);
  const roleConfig = ROLE_CONFIG[role] || { label: role, Icon: Users, color: 'text-slate-400 bg-slate-500/10' };
  const RoleIcon = roleConfig.Icon;

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const recentNotifications = await getMyNotifications(5);

  // Données enrichies pour ADMIN / MANAGER / COMPTABLE
  let enrichedData = null;
  if (['ADMIN', 'MANAGER', 'COMPTABLE'].includes(role) && session.structureId) {
    enrichedData = await getDashboardEnrichedData(session.structureId, currency);
  }

  // ─── KPI cards par rôle ───
  let statCards: any[] = [];
  let quickActions: any[] = [];

  if (stats.type === 'SUPER_ADMIN') {
    statCards = [
      { title: 'Structures', value: stats.data.structuresCount, icon: Building2, color: 'text-blue-400', bgColor: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-cyan-500/20' },
      { title: 'Licences actives', value: stats.data.licensesCount, icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/10', gradient: 'from-green-500/20 to-emerald-500/20' },
      { title: 'Utilisateurs', value: stats.data.allUsersCount, icon: Users, color: 'text-purple-400', bgColor: 'bg-purple-500/10', gradient: 'from-purple-500/20 to-pink-500/20' },
      { title: 'Commandes globales', value: stats.data.allOrdersCount, icon: ShoppingCart, color: 'text-orange-400', bgColor: 'bg-orange-500/10', gradient: 'from-orange-500/20 to-red-500/20' },
    ];
    quickActions = [
      { href: '/structures', label: 'Gérer les structures', icon: Building2 },
      { href: '/users', label: 'Voir les utilisateurs', icon: Users },
      { href: '/statistics', label: 'Voir les analyses', icon: TrendingUp },
    ];
  } else if (stats.type === 'ADMIN' || stats.type === 'MANAGER') {
    statCards = [
      { title: 'CA Aujourd\'hui', value: formatAmount(enrichedData?.todayRevenue || 0, currency), icon: DollarSign, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', gradient: 'from-emerald-500/20 to-teal-500/20' },
      { title: 'CA ce mois', value: formatAmount(enrichedData?.monthRevenue || 0, currency), icon: TrendingUp, color: 'text-blue-400', bgColor: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-cyan-500/20' },
      { title: 'Ticket moyen (30j)', value: formatAmount(enrichedData?.avgOrderValue || 0, currency), icon: Ticket, color: 'text-violet-400', bgColor: 'bg-violet-500/10', gradient: 'from-violet-500/20 to-purple-500/20' },
      { title: 'Commandes en cours', value: enrichedData?.activeOrdersCount || 0, icon: Clock, color: 'text-orange-400', bgColor: 'bg-orange-500/10', gradient: 'from-orange-500/20 to-red-500/20' },
      { title: 'Total commandes', value: stats.data.ordersCount, icon: ShoppingCart, color: 'text-sky-400', bgColor: 'bg-sky-500/10', gradient: 'from-sky-500/20 to-blue-500/20' },
      { title: 'Produits actifs', value: stats.data.productsCount, icon: Package, color: 'text-green-400', bgColor: 'bg-green-500/10', gradient: 'from-green-500/20 to-emerald-500/20' },
      { title: 'Équipe', value: stats.data.usersCount, icon: Users, color: 'text-purple-400', bgColor: 'bg-purple-500/10', gradient: 'from-purple-500/20 to-pink-500/20' },
      { title: 'CA Total', value: formatAmount(stats.data.totalRevenue || 0, currency), icon: DollarSign, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', gradient: 'from-yellow-500/20 to-orange-500/20' },
    ];
    quickActions = [
      { href: '/orders/new', label: 'Nouvelle commande', icon: ShoppingCart },
      { href: '/products', label: 'Gérer les produits', icon: TrendingUp },
      { href: '/users', label: 'Gérer l\'équipe', icon: Users },
      { href: '/statistics', label: 'Statistiques', icon: BarChart2 },
      { href: '/stock', label: 'Stock', icon: Boxes },
      { href: '/shifts', label: 'Sessions caisse', icon: Clock },
    ];
  } else if (stats.type === 'CAISSE') {
    statCards = [
      { title: 'Commandes aujourd\'hui', value: stats.data.todayOrdersCount, icon: ShoppingCart, color: 'text-blue-400', bgColor: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-cyan-500/20' },
      { title: 'Commandes en attente', value: stats.data.pendingOrdersCount, icon: Clock, color: 'text-orange-400', bgColor: 'bg-orange-500/10', gradient: 'from-orange-500/20 to-red-500/20' },
      { title: 'CA aujourd\'hui', value: formatAmount(stats.data.todayRevenue || 0, currency), icon: DollarSign, color: 'text-green-400', bgColor: 'bg-green-500/10', gradient: 'from-green-500/20 to-emerald-500/20' },
    ];
    quickActions = [
      { href: '/orders/new', label: 'Nouvelle commande', icon: ShoppingCart },
      { href: '/orders', label: 'Voir les commandes', icon: Clock },
    ];
  } else if (stats.type === 'SERVEUR') {
    statCards = [
      { title: 'Mes commandes actives', value: stats.data.myActiveOrdersCount, icon: Clock, color: 'text-blue-400', bgColor: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-cyan-500/20' },
      { title: 'Commandes terminées aujourd\'hui', value: stats.data.myTodayCompletedCount, icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/10', gradient: 'from-green-500/20 to-emerald-500/20' },
    ];
    quickActions = [
      { href: '/orders/new', label: 'Nouvelle commande', icon: ShoppingCart },
      { href: '/orders', label: 'Mes commandes', icon: Clock },
    ];
  } else if (stats.type === 'RECEPTION') {
    statCards = [
      { title: 'Réservations aujourd\'hui', value: stats.data.todayBookingsCount, icon: Calendar, color: 'text-blue-400', bgColor: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-cyan-500/20' },
      { title: 'En attente', value: stats.data.pendingBookingsCount, icon: Clock, color: 'text-orange-400', bgColor: 'bg-orange-500/10', gradient: 'from-orange-500/20 to-red-500/20' },
      { title: 'Chambres disponibles', value: `${stats.data.availableRoomsCount}/${stats.data.totalRoomsCount}`, icon: Hotel, color: 'text-teal-400', bgColor: 'bg-teal-500/10', gradient: 'from-teal-500/20 to-cyan-500/20' },
      { title: 'Recettes aujourd\'hui', value: formatAmount(stats.data.todayRevenue || 0, currency), icon: DollarSign, color: 'text-green-400', bgColor: 'bg-green-500/10', gradient: 'from-green-500/20 to-emerald-500/20' },
    ];
    quickActions = [
      { href: '/bookings/new', label: 'Nouvelle réservation', icon: Calendar },
      { href: '/bookings', label: 'Voir les réservations', icon: Clock },
      { href: '/rooms', label: 'Gérer les chambres', icon: Hotel },
    ];
  } else if (stats.type === 'CUISINIER') {
    statCards = [
      { title: 'Commandes en attente', value: stats.data.pendingCount, icon: Clock, color: 'text-orange-400', bgColor: 'bg-orange-500/10', gradient: 'from-orange-500/20 to-red-500/20' },
      { title: 'En préparation', value: stats.data.inProgressCount, icon: ChefHat, color: 'text-blue-400', bgColor: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-cyan-500/20' },
    ];
    quickActions = [{ href: '/kitchen', label: 'Accéder à la cuisine', icon: ChefHat }];
  } else if (stats.type === 'BAR') {
    statCards = [
      { title: 'Commandes actives', value: stats.data.activeCount, icon: Beer, color: 'text-amber-400', bgColor: 'bg-amber-500/10', gradient: 'from-amber-500/20 to-orange-500/20' },
    ];
    quickActions = [{ href: '/bar', label: 'Accéder au bar', icon: Beer }];
  } else if (stats.type === 'MAGASINIER') {
    statCards = [
      { title: 'Articles en stock', value: stats.data.totalStock, icon: Boxes, color: 'text-pink-400', bgColor: 'bg-pink-500/10', gradient: 'from-pink-500/20 to-rose-500/20' },
    ];
    quickActions = [{ href: '/stock', label: 'Gérer le stock', icon: Boxes }];
  } else if (stats.type === 'COMPTABLE') {
    statCards = [
      { title: 'CA aujourd\'hui', value: formatAmount(stats.data.todayRevenue || 0, currency), icon: DollarSign, color: 'text-violet-400', bgColor: 'bg-violet-500/10', gradient: 'from-violet-500/20 to-purple-500/20' },
      { title: 'Sessions ouvertes', value: stats.data.shiftsCount, icon: Clock, color: 'text-blue-400', bgColor: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-cyan-500/20' },
    ];
    quickActions = [
      { href: '/statistics', label: 'Statistiques', icon: TrendingUp },
      { href: '/shifts', label: 'Sessions de caisse', icon: Clock },
    ];
  } else if (stats.type === 'RH') {
    statCards = [
      { title: 'Employés actifs', value: stats.data.usersCount, icon: Users, color: 'text-rose-400', bgColor: 'bg-rose-500/10', gradient: 'from-rose-500/20 to-pink-500/20' },
    ];
    quickActions = [{ href: '/users', label: 'Gérer l\'équipe', icon: Users }];
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Blobs décoratifs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* ── Header ── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1">
              {greet()}
            </h1>
            <p className="text-slate-400">Bienvenue sur votre espace {roleConfig.label}</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${roleConfig.color}`}>
            <RoleIcon className="w-4 h-4" />
            {roleConfig.label}
          </div>
        </div>

        {/* ── Cartes KPI ── */}
        {statCards.length > 0 && (
          <div className={`grid grid-cols-2 ${statCards.length >= 6 ? 'lg:grid-cols-4' : statCards.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4 mb-8`}>
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card key={index} className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 group relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300 leading-tight">{card.title}</CardTitle>
                    <div className={`${card.bgColor} p-2 rounded-lg group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-xl sm:text-2xl font-bold text-white leading-tight">{card.value?.toString()}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Graphiques enrichis ADMIN / MANAGER / COMPTABLE ── */}
        {enrichedData && (
          <div className="mb-8">
            <DashboardAdminCharts
              dailyRevenue={enrichedData.dailyRevenue}
              topProducts={enrichedData.topProducts}
              lowStockItems={enrichedData.lowStockItems}
              currency={currency}
            />
          </div>
        )}

        {/* ── Actions rapides & Notifications ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {quickActions.length > 0 && (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-slate-50 text-lg">Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickActions.map((action, index) => {
                      const ActionIcon = action.icon;
                      return (
                        <Link
                          key={index}
                          href={action.href}
                          className="group flex items-center justify-between p-4 rounded-lg bg-slate-900/30 border border-slate-700 hover:border-blue-500/50 transition-all duration-300 hover:bg-slate-800/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                              <ActionIcon className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-slate-200 font-medium text-sm">{action.label}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden h-full">
              <CardHeader className="border-b border-slate-700/50 flex flex-row items-center justify-between">
                <CardTitle className="text-slate-50 flex items-center gap-2 text-lg">
                  <Bell className="w-5 h-5 text-orange-400" />
                  Notifications
                </CardTitle>
                <Link href="/notifications" className="text-xs text-blue-400 hover:underline">
                  Voir tout
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {recentNotifications.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-sm italic">Aucune notification</div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {recentNotifications.slice(0, 4).map((notif) => (
                      <div key={notif.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                        <div className="flex gap-3">
                          <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-slate-600'}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${!notif.is_read ? 'text-slate-100' : 'text-slate-400'}`}>{notif.title}</p>
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{notif.body}</p>
                            <p className="text-[10px] text-slate-600 mt-1.5 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(notif.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-600">Shede ERP SaaS — v1.0 Phase 1</p>
        </div>
      </div>
    </div>
  );
}

// Import manquant
import { Package, BarChart2 } from 'lucide-react';