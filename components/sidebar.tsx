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
  Building2,
  Bell,
  Bed,
  CalendarDays,
  Boxes,
  Tag,
  History as HistoryIcon,
  ChefHat,
  Beer,
  Truck,
  BookOpen,
  UserCog,
  Tags,
  LayoutDashboard,
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

  useEffect(() => {
    const fetchCounts = async () => {
      const res = await getSidebarCounts();
      setCounts(res);
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const role = session.role;
  const hasHotelModule = structure?.modules?.includes('HOTEL') || storeHasModule('HOTEL');
  const hasStockModule = structure?.modules?.includes('STOCK') || storeHasModule('STOCK');
  const hasPromoModule = structure?.modules?.includes('PROMOTION') || storeHasModule('PROMOTION');
  const hasCuisineModule = structure?.modules?.includes('CUISINE') || storeHasModule('CUISINE');
  const hasBarModule = structure?.modules?.includes('BAR') || storeHasModule('BAR');
  const hasLivraisonModule = structure?.modules?.includes('LIVRAISON') || storeHasModule('LIVRAISON');
  const hasRHModule = structure?.modules?.includes('RH') || storeHasModule('RH');
  const hasCRMModule = structure?.modules?.includes('CRM') || storeHasModule('CRM');
  const hasTablesModule = structure?.modules?.includes('TABLES') || storeHasModule('TABLES');
  const canManageShift = ['CAISSE', 'RECEPTION', 'ADMIN', 'MANAGER'].includes(role);

  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);
  const isManagerOrAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(role);
  const isOps = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR'].includes(role);

  const navigationItems = [
    // ── Général ──
    {
      name: 'Tableau de bord',
      href: '/dashboard',
      icon: Home,
      visible: true,
    },

    // ── Commandes ──
    {
      name: 'Commandes',
      href: '/orders',
      icon: ShoppingCart,
      visible: isOps,
      badge: counts.orders,
      badgeColor: 'bg-red-500',
    },

    // ── Cuisine & Bar ──
    {
      name: 'Cuisine (KDS)',
      href: '/kitchen',
      icon: ChefHat,
      visible: hasCuisineModule && (isManagerOrAdmin || role === 'CUISINIER'),
    },
    {
      name: 'Bar',
      href: '/bar',
      icon: Beer,
      visible: hasBarModule && (isManagerOrAdmin || role === 'BAR'),
    },

    // ── Catalogue ──
    {
      name: 'Catégories',
      href: '/categories',
      icon: Tags,
      visible: isManagerOrAdmin,
    },
    {
      name: 'Plan de salle',
      href: '/floor-manager',
      icon: LayoutDashboard,
      visible: hasTablesModule && (isManagerOrAdmin || role === 'CAISSE' || role === 'SERVEUR'),
    },
    {
      name: 'Produits',
      href: '/products',
      icon: Package,
      visible: isManagerOrAdmin,
    },
    {
      name: 'Accompagnements',
      href: '/accompaniments',
      icon: Package,
      visible: isManagerOrAdmin,
    },

    // ── Stock ──
    {
      name: 'Stock',
      href: '/stock',
      icon: Boxes,
      visible: (hasStockModule && isManagerOrAdmin) || role === 'MAGASINIER',
      badge: counts.stock,
      badgeColor: 'bg-orange-500',
    },

    // ── Livraison ──
    {
      name: 'Livraisons',
      href: '/delivery',
      icon: Truck,
      visible: hasLivraisonModule && (isManagerOrAdmin || role === 'LIVREUR'),
    },

    // ── Hôtel ──
    {
      name: 'Chambres',
      href: '/rooms',
      icon: Bed,
      visible: hasHotelModule && (isManagerOrAdmin || role === 'RECEPTION'),
    },
    {
      name: 'Réservations',
      href: '/bookings',
      icon: CalendarDays,
      visible: hasHotelModule && (isManagerOrAdmin || role === 'RECEPTION'),
      badge: counts.bookings,
      badgeColor: 'bg-purple-500',
    },

    // ── Marketing ──
    {
      name: 'Promotions',
      href: '/promotions',
      icon: Tag,
      visible: hasPromoModule && isManagerOrAdmin,
    },

    // ── Équipe & CRM ──
    {
      name: 'Clients (CRM)',
      href: '/clients',
      icon: Users, // Or Handshake
      visible: hasCRMModule && (isManagerOrAdmin || role === 'CAISSE'),
    },
    {
      name: 'Utilisateurs',
      href: '/users',
      icon: Users,
      visible: isAdmin || (hasRHModule && role === 'RH'),
    },

    // ── Finances & Stats ──
    {
      name: 'Statistiques',
      href: '/statistics',
      icon: BarChart3,
      visible: isManagerOrAdmin || role === 'COMPTABLE',
    },
    {
      name: 'Sessions de caisse',
      href: '/shifts',
      icon: HistoryIcon,
      visible: isAdmin || role === 'COMPTABLE',
    },

    // ── Super Admin ──
    {
      name: 'Structures',
      href: '/structures',
      icon: Building2,
      visible: role === 'SUPER_ADMIN',
    },

    // ── Global ──
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      visible: true,
      badge: counts.notifications,
      badgeColor: 'bg-blue-600',
    },
    {
      name: 'Paramètres',
      href: '/settings',
      icon: Settings,
      visible: true,
    },
  ];

  const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
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
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo.webp" alt="Shede" className="w-8 h-8 rounded-lg" />
          <h1 className="text-xl font-bold text-slate-50">Shede</h1>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          if (!item.visible) return null;

          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

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
              {(item as any).badge > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold leading-none text-white rounded-full min-w-5 h-5',
                  (item as any).badgeColor || 'bg-red-500',
                  !isActive && 'animate-pulse'
                )}>
                  {(item as any).badge > 99 ? '99+' : (item as any).badge}
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
