'use client';

import type { SessionPayload } from '@/lib/auth';
import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { getUnreadNotificationsCount } from '@/app/actions/push';
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';
import { LanguageSwitcher } from '@/components/language-switcher';
import type { Appearance } from '@/lib/theme';
import { useLiveRefresh } from '@/components/displays/use-live-refresh';

interface TopNavProps {
  session: SessionPayload;
  onMenuClick?: () => void;
  /** Apparence affichée ; null tant que celle de l'appareil n'est pas connue. */
  appearance: Appearance | null;
  onToggleTheme: () => void;
}

export function TopNav({ session, onMenuClick, appearance, onToggleTheme }: TopNavProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useT();
  // Les notifications sont rattachées à un point : l'ORG_ADMIN n'en reçoit pas.
  const showNotifications = session.role !== 'ORG_ADMIN';
  const themeLabel = appearance === 'clair' ? 'nav.themeDark' : appearance === 'sombre' ? 'nav.themeLight' : 'nav.themeToggle';

  const loadUnread = useCallback(async () => {
    setUnreadCount(await getUnreadNotificationsCount());
  }, []);
  useEffect(() => {
    if (showNotifications) loadUnread().catch(() => undefined);
  }, [showNotifications, loadUnread]);
  // Puis toutes les 30 s (pause onglet caché) et dès qu'une notification push arrive
  useLiveRefresh(loadUnread, { intervalMs: 30_000, paused: !showNotifications });
  return (
    <header className="print:hidden flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-800 px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-slate-400 hover:text-slate-200 lg:hidden"
          aria-label={t('nav.openMenu')}
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative min-w-0 flex-1 max-w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder={t('common.search')}
            className="min-w-0 border-slate-600 bg-slate-700 pl-9 text-sm text-slate-50 placeholder:text-slate-500 sm:text-base"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <LanguageSwitcher />
        {showNotifications && (
        <Link href="/notifications">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-200 relative"
            aria-label={t('nav.notifications')}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-slate-800">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </Link>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-slate-200"
          aria-label={t(themeLabel)}
          title={t(themeLabel)}
          onClick={onToggleTheme}
        >
          {/* Icône choisie par le CSS (variante dark:) : juste dès le premier affichage, même en thème du système */}
          <Sun className="hidden h-5 w-5 dark:block" />
          <Moon className="h-5 w-5 dark:hidden" />
        </Button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 sm:h-10 sm:w-10">
          <span className="text-sm font-medium text-white">
            {session.email.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}
