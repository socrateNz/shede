'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileNavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}

export function MobileNavItem({ href, icon, label, exact = false }: MobileNavItemProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 ${
        isActive
          ? 'text-blue-600 bg-blue-50/80 scale-105'
          : 'text-slate-500 hover:text-blue-500 hover:bg-slate-50'
      }`}
    >
      <div className="relative">
        {icon}
        {isActive && (
          <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
        )}
      </div>
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}
