'use client';

import { SessionPayload } from '@/lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ShoppingCart,
  Users,
  Package,
  Settings,
  LogOut,
  Home,
  Bell,
  Bed,
  CalendarDays,
  Boxes,
  Tag,
  History as HistoryIcon,
  ChefHat,
  Beer,
  Truck,
  LayoutDashboard,
  Network,
} from 'lucide-react';
import { ShiftStatusIndicator } from './shift-status-indicator';
import { logout } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Structure } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { getSidebarCounts } from '@/app/actions/sidebar';

interface SidebarProps {
  session: SessionPayload;
  structure: Structure | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ session, structure, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const storeHasModule = useAppStore(state => state.hasModule);
  const [counts, setCounts] = useState({ orders: 0, stock: 0, bookings: 0, notifications: 0 });

  const role = session.role;
  const isOrgAdmin = role === 'ORG_ADMIN';

  useEffect(() => {
    // ORG_ADMIN et SUPER_ADMIN ne sont rattachés à aucun point : pas de compteurs opérationnels.
    if (!session.structureId) return;
    const fetchCounts = async () => {
      const res = await getSidebarCounts();
      setCounts(res);
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [session.structureId]);

  const hasModule = (moduleName: string) =>
    Boolean(structure?.modules?.includes(moduleName)) || storeHasModule(moduleName);
  const canManageShift = ['CAISSE', 'RECEPTION', 'ADMIN', 'MANAGER'].includes(role);

  /**
   * `roles` = rôles qui peuvent réellement ouvrir la page : intersection de la
   * règle du middleware (middleware.ts) et du requireRole() de la page. Un lien
   * n'est affiché que s'il mène à une page utilisable par le rôle connecté.
   */
  type NavItem = {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: string[];
    module?: string;
    /** Actif uniquement sur l'URL exacte (pas sur ses sous-pages). */
    exact?: boolean;
    badge?: number;
    badgeColor?: string;
  };

  const superAdminItems: NavItem[] = [
    { name: 'Tableau de bord', href: '/dashboard', icon: Home, roles: ['SUPER_ADMIN'] },
    { name: 'Organisations', href: '/structures', icon: Network, roles: ['SUPER_ADMIN'] },
  ];

  const orgAdminItems: NavItem[] = [
    { name: 'Vue propriétaire', href: '/organization', icon: BarChart3, roles: ['ORG_ADMIN'], exact: true },
    { name: 'Rapports de caisse', href: '/organization/cash', icon: HistoryIcon, roles: ['ORG_ADMIN'] },
    { name: 'Points & licence', href: '/organization/points', icon: Network, roles: ['ORG_ADMIN'] },
  ];

  const pointItems: NavItem[] = [
    // ── Général ── (pas de tableau de bord dédié au livreur)
    {
      name: 'Tableau de bord',
      href: '/dashboard',
      icon: Home,
      roles: ['ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR', 'RECEPTION', 'CUISINIER', 'BAR', 'COMPTABLE', 'MAGASINIER', 'RH'],
    },

    // ── Commandes ──
    {
      name: 'Commandes',
      href: '/orders',
      icon: ShoppingCart,
      roles: ['ADMIN', 'CAISSE', 'SERVEUR'],
      badge: counts.orders,
      badgeColor: 'bg-red-500',
    },
    {
      name: 'Plan de salle',
      href: '/floor-manager',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR'],
      module: 'TABLES',
    },

    // ── Cuisine & Bar ──
    { name: 'Cuisine (KDS)', href: '/kitchen', icon: ChefHat, roles: ['ADMIN', 'MANAGER', 'CUISINIER'], module: 'CUISINE' },
    { name: 'Bar', href: '/bar', icon: Beer, roles: ['ADMIN', 'MANAGER', 'BAR'], module: 'BAR' },

    // ── Catalogue ──
    { name: 'Produits', href: '/products', icon: Package, roles: ['ADMIN'] },
    { name: 'Accompagnements', href: '/accompaniments', icon: Package, roles: ['ADMIN', 'MANAGER'] },

    // ── Stock ──
    {
      name: 'Stock',
      href: '/stock',
      icon: Boxes,
      roles: ['ADMIN', 'MANAGER', 'MAGASINIER'],
      module: 'STOCK',
      badge: counts.stock,
      badgeColor: 'bg-orange-500',
    },

    // ── Livraison ──
    { name: 'Livraisons', href: '/delivery', icon: Truck, roles: ['ADMIN', 'MANAGER', 'LIVREUR'], module: 'LIVRAISON' },

    // ── Hôtel ──
    { name: 'Chambres', href: '/rooms', icon: Bed, roles: ['ADMIN', 'RECEPTION'], module: 'HOTEL' },
    {
      name: 'Réservations',
      href: '/bookings',
      icon: CalendarDays,
      roles: ['ADMIN', 'RECEPTION'],
      module: 'HOTEL',
      badge: counts.bookings,
      badgeColor: 'bg-purple-500',
    },

    // ── Marketing ──
    { name: 'Promotions', href: '/promotions', icon: Tag, roles: ['ADMIN'], module: 'PROMOTION' },

    // ── Équipe & CRM ──
    { name: 'Clients (CRM)', href: '/clients', icon: Users, roles: ['ADMIN', 'MANAGER', 'CAISSE'], module: 'CRM' },
    { name: 'Utilisateurs', href: '/users', icon: Users, roles: ['ADMIN'] },

    // ── Finances & Stats ──
    { name: 'Statistiques', href: '/statistics', icon: BarChart3, roles: ['ADMIN'] },
    { name: 'Sessions de caisse', href: '/shifts', icon: HistoryIcon, roles: ['ADMIN'] },

    // ── Global ──
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      roles: ['ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR', 'RECEPTION', 'CUISINIER', 'BAR', 'LIVREUR', 'COMPTABLE', 'MAGASINIER', 'RH'],
      badge: counts.notifications,
      badgeColor: 'bg-blue-600',
    },
    {
      name: 'Paramètres',
      href: '/settings',
      icon: Settings,
      roles: ['ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR', 'RECEPTION', 'CUISINIER', 'BAR', 'LIVREUR', 'COMPTABLE', 'MAGASINIER', 'RH'],
    },
  ];

  const navigationItems = (
    role === 'SUPER_ADMIN' ? superAdminItems : isOrgAdmin ? orgAdminItems : pointItems
  ).filter((item) => item.roles.includes(role) && (!item.module || hasModule(item.module)));
  const homeHref = isOrgAdmin ? '/organization' : '/dashboard';

  const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ORG_ADMIN: 'Admin organisation',
    ADMIN: 'Administrateur',
    MANAGER: 'Manager',
    CAISSE: 'Caisse',
    SERVEUR: 'Serveur',
    RECEPTION: 'Réception',
    CUISINIER: 'Cuisinier',
    BAR: 'Bar',
    LIVREUR: 'Livreur',
    COMPTABLE: 'Comptable',
    MAGASINIER: 'Magasinier',
    RH: 'RH',
    CLIENT: 'Client',
  };

  return (
    <aside
      className={cn(
        'print:hidden z-50 flex w-64 shrink-0 flex-col border-r border-slate-700 bg-slate-800',
        'fixed inset-y-0 left-0 transition-transform duration-200 ease-out lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <Link href={homeHref} className="flex items-center gap-2">
          <img src="/logo.webp" alt="Shede" className="w-8 h-8 rounded-lg" />
          <h1 className="text-xl font-bold text-slate-50">Shede</h1>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/'));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onMobileClose?.()}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] transition-colors min-h-11 lg:min-h-0 lg:py-2 lg:text-base group',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              )}
            >
              <Icon className={cn('w-5 h-5 shrink-0', !isActive && 'group-hover:text-slate-200')} />
              <span className="font-medium flex-1 truncate">{item.name}</span>
              {(item.badge ?? 0) > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold leading-none text-white rounded-full min-w-5 h-5',
                  item.badgeColor || 'bg-red-500',
                  !isActive && 'animate-pulse'
                )}>
                  {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 space-y-3">
        {canManageShift && (
          <div className="pb-2">
            <ShiftStatusIndicator />
          </div>
        )}
        <div className="px-4 py-2 bg-slate-700 rounded-lg">
          <p className="text-xs text-slate-400">Rôle</p>
          <p className="text-sm font-medium text-slate-50">
            {ROLE_LABELS[role] || role}
          </p>
          {structure?.name && (
            <p className="text-xs text-slate-400 truncate mt-0.5" title={structure.name}>
              {structure.name}
            </p>
          )}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
