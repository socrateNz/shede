import Link from 'next/link';
import { requireAuth } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, ShoppingCart, DollarSign, Clock, CheckCircle, Building2, Sparkles, ArrowRight, Coffee, CreditCard, Hotel, Calendar, Bell, ExternalLink } from 'lucide-react';
import { getMyNotifications } from '@/app/actions/push';

async function getDashboardStats(structureId: string, role: string, userId: string) {
  const admin = getAdminSupabase();

  if (role === 'SUPER_ADMIN') {
    const { count: structuresCount } = await admin.from('structures').select('*', { count: 'exact', head: true });
    const { count: licensesCount } = await admin.from('licenses').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const { count: allUsersCount } = await admin.from('users').select('*', { count: 'exact', head: true });
    const { count: allOrdersCount } = await admin.from('orders').select('*', { count: 'exact', head: true });

    return {
      type: 'SUPER_ADMIN',
      data: {
        structuresCount: structuresCount || 0,
        licensesCount: licensesCount || 0,
        allUsersCount: allUsersCount || 0,
        allOrdersCount: allOrdersCount || 0,
      }
    };
  }

  if (role === 'ADMIN') {
    const { count: ordersCount } = await admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId);

    const { count: productsCount } = await admin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .eq('is_deleted', false);

    const { count: usersCount } = await admin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId);

    // Chiffre d'affaires global: Commandes + Réservations
    const { data: completedOrders } = await admin
      .from('orders')
      .select('total')
      .eq('structure_id', structureId)
      .eq('status', 'COMPLETED');

    const { data: paidBookings } = await admin
      .from('bookings')
      .select('total_amount, rooms!inner(structure_id)')
      .eq('rooms.structure_id', structureId)
      .or(`status.eq.COMPLETED,is_paid.eq.true`);

    const orderRevenue = completedOrders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;
    const hotelRevenue = paidBookings?.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) || 0;

    return {
      type: 'ADMIN',
      data: {
        ordersCount: ordersCount || 0,
        productsCount: productsCount || 0,
        usersCount: usersCount || 0,
        totalRevenue: orderRevenue + hotelRevenue,
      }
    };
  }

  if (role === 'CAISSE') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { count: todayOrdersCount } = await admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .gte('created_at', todayIso);

    const { count: pendingOrdersCount } = await admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .in('status', ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED']);

    const { data: todayOrders } = await admin
      .from('orders')
      .select('id')
      .eq('structure_id', structureId)
      .gte('created_at', todayIso);

    const { data: todayCompletedOrders } = await admin
      .from('orders')
      .select('total')
      .eq('structure_id', structureId)
      .eq('status', 'COMPLETED')
      .gte('updated_at', todayIso);

    const todayOrderRevenue = todayCompletedOrders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

    const { data: todayPaidBookings } = await admin
      .from('bookings')
      .select('total_amount, rooms!inner(structure_id)')
      .eq('rooms.structure_id', structureId)
      .or(`status.eq.COMPLETED,is_paid.eq.true`)
      .gte('updated_at', todayIso);

    const todayHotelRevenue = todayPaidBookings?.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) || 0;

    return {
      type: 'CAISSE',
      data: {
        todayOrdersCount: todayOrdersCount || 0,
        todayRevenue: todayOrderRevenue + todayHotelRevenue,
        pendingOrdersCount: pendingOrdersCount || 0,
      }
    };
  }

  if (role === 'SERVEUR') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { count: myActiveOrdersCount } = await admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .eq('user_id', userId)
      .in('status', ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED']);

    const { count: myTodayCompletedCount } = await admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .eq('user_id', userId)
      .eq('status', 'COMPLETED')
      .gte('created_at', todayIso);

    return {
      type: 'SERVEUR',
      data: {
        myActiveOrdersCount: myActiveOrdersCount || 0,
        myTodayCompletedCount: myTodayCompletedCount || 0,
      }
    };
  }

  if (role === 'RECEPTION') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { count: todayBookingsCount } = await admin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .gte('created_at', todayIso);

    const { count: pendingBookingsCount } = await admin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .eq('status', 'PENDING');

    const { count: totalRoomsCount } = await admin
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId);

    const { count: availableRoomsCount } = await admin
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .eq('is_available', true);

    const { data: todayPaidBookings } = await admin
      .from('bookings')
      .select('total_amount, rooms!inner(structure_id)')
      .eq('rooms.structure_id', structureId)
      .or(`status.eq.COMPLETED,is_paid.eq.true`)
      .gte('updated_at', todayIso);

    const todayHotelRevenue = todayPaidBookings?.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) || 0;

    // Inclusion des commandes restaurant d'aujourd'hui pour la réception si mixte
    const { data: todayCompletedOrders } = await admin
      .from('orders')
      .select('total')
      .eq('structure_id', structureId)
      .eq('status', 'COMPLETED')
      .gte('updated_at', todayIso);
    
    const todayOrderRevenue = todayCompletedOrders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

    return {
      type: 'RECEPTION',
      data: {
        todayBookingsCount: todayBookingsCount || 0,
        pendingBookingsCount: pendingBookingsCount || 0,
        totalRoomsCount: totalRoomsCount || 0,
        availableRoomsCount: availableRoomsCount || 0,
        todayRevenue: todayHotelRevenue + todayOrderRevenue,
      }
    };
  }

  return { type: 'UNKNOWN', data: {} };
}

function getWelcomeMessage(firstName?: string) {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function getRoleBadge(role: string) {
  const badges: Record<string, { label: string; icon: any; color: string }> = {
    SUPER_ADMIN: { label: 'Super Administrateur', icon: Shield, color: 'text-red-400 bg-red-500/10' },
    ADMIN: { label: 'Administrateur', icon: Shield, color: 'text-purple-400 bg-purple-500/10' },
    CAISSE: { label: 'Caisse', icon: CreditCard, color: 'text-blue-400 bg-blue-500/10' },
    SERVEUR: { label: 'Serveur', icon: Coffee, color: 'text-emerald-400 bg-emerald-500/10' },
    RECEPTION: { label: 'Réception', icon: Hotel, color: 'text-teal-400 bg-teal-500/10' },
  };
  return badges[role] || { label: role, icon: Users, color: 'text-slate-400 bg-slate-500/10' };
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const stats = await getDashboardStats(session.structureId!, session.role as string, session.userId);
  const welcomeMessage = getWelcomeMessage(session.email.split('@')[0]);
  const roleBadge = getRoleBadge(session.role as string);
  const RoleIcon = roleBadge.icon;
  const recentNotifications = await getMyNotifications(5);

  let statCards: any[] = [];
  let quickActions: any[] = [];

  if (stats.type === 'SUPER_ADMIN') {
    statCards = [
      {
        title: 'Structures',
        value: stats.data.structuresCount?.toString() || '0',
        icon: Building2,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Licences actives',
        value: stats.data.licensesCount?.toString() || '0',
        icon: CheckCircle,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
      {
        title: 'Utilisateurs',
        value: stats.data.allUsersCount?.toString() || '0',
        icon: Users,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: 'Commandes globales',
        value: stats.data.allOrdersCount?.toString() || '0',
        icon: ShoppingCart,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        gradient: 'from-orange-500/20 to-red-500/20',
      },
    ];
    quickActions = [
      { href: '/structures', label: 'Gérer les structures', icon: Building2 },
      { href: '/users', label: 'Voir les utilisateurs', icon: Users },
      { href: '/analytics', label: 'Voir les analyses', icon: TrendingUp },
    ];
  } else if (stats.type === 'ADMIN') {
    statCards = [
      {
        title: 'Commandes',
        value: stats.data.ordersCount?.toString() || '0',
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Produits',
        value: stats.data.productsCount?.toString() || '0',
        icon: TrendingUp,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
      {
        title: 'Équipe',
        value: stats.data.usersCount?.toString() || '0',
        icon: Users,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        gradient: 'from-purple-500/20 to-pink-500/20',
      },
      {
        title: 'Chiffre d\'affaires',
        value: `${(stats.data.totalRevenue || 0).toLocaleString()} FCFA`,
        icon: DollarSign,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        gradient: 'from-orange-500/20 to-red-500/20',
      },
    ];
    quickActions = [
      { href: '/orders/new', label: 'Nouvelle commande', icon: ShoppingCart },
      { href: '/products', label: 'Gérer les produits', icon: TrendingUp },
      { href: '/users', label: 'Gérer l\'équipe', icon: Users },
    ];
  } else if (stats.type === 'CAISSE') {
    statCards = [
      {
        title: 'Commandes aujourd\'hui',
        value: stats.data.todayOrdersCount?.toString() || '0',
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Commandes en attente',
        value: stats.data.pendingOrdersCount?.toString() || '0',
        icon: Clock,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        gradient: 'from-orange-500/20 to-red-500/20',
      },
      {
        title: 'CA aujourd\'hui',
        value: `${(stats.data.todayRevenue || 0).toLocaleString()} FCFA`,
        icon: DollarSign,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
    ];
    quickActions = [
      { href: '/orders/new', label: 'Nouvelle commande', icon: ShoppingCart },
      { href: '/orders', label: 'Voir les commandes', icon: Clock },
    ];
  } else if (stats.type === 'SERVEUR') {
    statCards = [
      {
        title: 'Mes commandes actives',
        value: stats.data.myActiveOrdersCount?.toString() || '0',
        icon: Clock,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Commandes terminées',
        value: stats.data.myTodayCompletedCount?.toString() || '0',
        icon: CheckCircle,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
    ];
    quickActions = [
      { href: '/orders/new', label: 'Nouvelle commande', icon: ShoppingCart },
      { href: '/orders', label: 'Voir mes commandes', icon: Clock },
    ];
  } else if (stats.type === 'RECEPTION') {
    statCards = [
      {
        title: 'Réservations aujourd\'hui',
        value: stats.data.todayBookingsCount?.toString() || '0',
        icon: Calendar,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        gradient: 'from-blue-500/20 to-cyan-500/20',
      },
      {
        title: 'Réservations en attente',
        value: stats.data.pendingBookingsCount?.toString() || '0',
        icon: Clock,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        gradient: 'from-orange-500/20 to-red-500/20',
      },
      {
        title: 'Chambres disponibles',
        value: `${stats.data.availableRoomsCount || 0} / ${stats.data.totalRoomsCount || 0}`,
        icon: Hotel,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        gradient: 'from-green-500/20 to-emerald-500/20',
      },
      {
        title: 'Recettes aujourd\'hui',
        value: `${(stats.data.todayRevenue || 0).toLocaleString()} FCFA`,
        icon: DollarSign,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        gradient: 'from-orange-500/20 to-red-500/20',
      },
    ];
    quickActions = [
      { href: '/bookings/new', label: 'Nouvelle réservation', icon: Calendar },
      { href: '/bookings', label: 'Voir les réservations', icon: Clock },
      { href: '/rooms', label: 'Gérer les chambres', icon: Hotel },
    ];
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header avec bienvenue */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400 font-medium">Tableau de bord</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
                {welcomeMessage},
              </h1>
              <p className="text-slate-400">
                Bienvenue sur votre espace {roleBadge.label}
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${roleBadge.color}`}>
              <RoleIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{roleBadge.label}</span>
            </div>
          </div>
        </div>

        {/* Cartes de statistiques */}
        {statCards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card
                  key={index}
                  className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className="text-sm font-medium text-slate-300">
                      {card.title}
                    </CardTitle>
                    <div className={`${card.bgColor} p-2 rounded-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-2xl font-bold text-white">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Actions rapides & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {quickActions.length > 0 && (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-slate-50 flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    Actions rapides
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <span className="text-slate-200 font-medium">{action.label}</span>
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
                <Link href="/notifications" className="text-xs text-blue-400 hover:underline">Voir tout</Link>
              </CardHeader>
              <CardContent className="p-0">
                {recentNotifications.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-sm italic">
                    Aucune notification
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {recentNotifications.slice(0, 3).map((notif) => (
                      <div key={notif.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                        <div className="flex gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-slate-600'}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${!notif.is_read ? 'text-slate-100' : 'text-slate-400'}`}>
                              {notif.title}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {notif.body}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-2 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(notif.created_at).toLocaleDateString()}
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
          <p className="text-xs text-slate-500">
            Shede POS - Système de gestion intégré
          </p>
        </div>
      </div>
    </div>
  );
}

// Import manquant pour Shield
import { Shield } from 'lucide-react';