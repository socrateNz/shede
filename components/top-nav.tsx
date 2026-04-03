'use client';

import { SessionPayload } from '@/lib/auth';
import { Bell, Menu, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { getUnreadNotificationsCount } from '@/app/actions/push';
import Link from 'next/link';

interface TopNavProps {
  session: SessionPayload;
  onMenuClick?: () => void;
}

export function TopNav({ session, onMenuClick }: TopNavProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const count = await getUnreadNotificationsCount();
      setUnreadCount(count);
    };
    fetchCount();
    
    // Simple interval for polling notifications (every 30s)
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-800 px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-slate-400 hover:text-slate-200 lg:hidden"
          aria-label="Ouvrir le menu"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative min-w-0 flex-1 max-w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Rechercher…"
            className="min-w-0 border-slate-600 bg-slate-700 pl-9 text-sm text-slate-50 placeholder:text-slate-500 sm:text-base"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <Link href="/notifications">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-200 relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-slate-800">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </Link>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 sm:h-10 sm:w-10">
          <span className="text-sm font-medium text-white">
            {session.email.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}
