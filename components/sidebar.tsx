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
    const interval = setInterval(fetchCounts, 30000); // 30 seconds for better responsiveness
    return () => clearInterval(interval);
  }, []);

  const hasHotelModule = structure?.modules?.includes('HOTEL') || storeHasModule('HOTEL');
  const hasStockModule = structure?.modules?.includes('STOCK') || storeHasModule('STOCK');
  const canManageShift = ['CAISSE', 'RECEPTION', 'ADMIN'].includes(session.role);

  const navigationItems = [
    {
      name: 'Tableau de bord',
      href: '/dashboard',
      icon: Home,
      visible: true,
    },
    {
      name: 'Commandes',
      href: '/orders',
      icon: ShoppingCart,
      visible: ['CAISSE', 'SERVEUR', 'ADMIN'].includes(session.role),
      badge: counts.orders,
      badgeColor: 'bg-red-500',
    },
    {
      name: 'Produits',
      href: '/products',
      icon: Package,
      visible: ['ADMIN'].includes(session.role),
    },
    {
      name: 'Stock',
      href: '/stock',
      icon: Boxes,
      visible: hasStockModule && ['ADMIN'].includes(session.role),
      badge: counts.stock,
      badgeColor: 'bg-orange-500',
    },
    {
      name: 'Utilisateurs',
      href: '/users',
      icon: Users,
      visible: ['ADMIN', 'SUPER_ADMIN'].includes(session.role),
    },
    {
      name: 'Accompagnements',
      href: '/accompaniments',
      icon: Package,
      visible: ['ADMIN'].includes(session.role),
    },
    {
      name: 'Chambres',
      href: '/rooms',
      icon: Bed,
      visible: hasHotelModule && ['ADMIN', 'RECEPTION'].includes(session.role),
    },
    {
      name: 'Réservations',
      href: '/bookings',
      icon: CalendarDays,
      visible: hasHotelModule && ['ADMIN', 'RECEPTION'].includes(session.role),
      badge: counts.bookings,
      badgeColor: 'bg-purple-500',
    },
    {
      name: 'Promotions',
      href: '/promotions',
      icon: Tag,
      visible: (structure?.modules?.includes('PROMOTION') || storeHasModule('PROMOTION')) && ['ADMIN'].includes(session.role),
    },
    {
      name: 'Structures',
      href: '/structures',
      icon: Building2,
      visible: ['SUPER_ADMIN'].includes(session.role),
    },
    {
      name: 'Statistiques',
      href: '/statistics',
      icon: BarChart3,
      visible: ['ADMIN', 'SUPER_ADMIN'].includes(session.role),
    },
    {
      name: 'Sessions de caisse',
      href: '/shifts',
      icon: HistoryIcon,
      visible: ['ADMIN', 'SUPER_ADMIN'].includes(session.role),
    },
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

  return (
    <aside
      className={cn(
        'z-50 flex w-64 shrink-0 flex-col border-r border-slate-700 bg-slate-800',
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
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
              <Icon className={cn("w-5 h-5", !isActive && "group-hover:text-slate-200")} />
              <span className="font-medium flex-1">{item.name}</span>
              {(item as any).badge > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold leading-none text-white rounded-full min-w-5 h-5",
                  (item as any).badgeColor || 'bg-red-500',
                  !isActive && "animate-pulse"
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
          <p className="text-xs text-slate-400">Role</p>
          <p className="text-sm font-medium text-slate-50">{session.role}</p>
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
