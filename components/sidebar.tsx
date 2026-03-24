'use client';

import { SessionPayload } from '@/lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ShoppingCart, Users, Package, Settings, LogOut, Home, Building2, Bell } from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

interface SidebarProps {
  session: SessionPayload;
}

export function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      visible: true,
    },
    {
      name: 'Orders',
      href: '/orders',
      icon: ShoppingCart,
      visible: ['CAISSE', 'SERVEUR', 'ADMIN', 'SUPER_ADMIN'].includes(session.role),
    },
    {
      name: 'Products',
      href: '/products',
      icon: Package,
      visible: ['ADMIN', 'SUPER_ADMIN'].includes(session.role),
    },
    {
      name: 'Users',
      href: '/users',
      icon: Users,
      visible: ['ADMIN', 'SUPER_ADMIN'].includes(session.role),
    },
    {
      name: 'Structures',
      href: '/structures',
      icon: Building2,
      visible: ['SUPER_ADMIN'].includes(session.role),
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      visible: ['ADMIN', 'SUPER_ADMIN'].includes(session.role),
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      visible: true,
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      visible: true,
    },
  ];

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div> */}
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
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 space-y-2">
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
            <span className="font-medium">Logout</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
