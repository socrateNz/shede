'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionPayload } from '@/lib/auth';
import type { Structure } from '@/lib/supabase';
import { Sidebar } from '@/components/sidebar';
import { TopNav } from '@/components/top-nav';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n/client';
import { THEME_COOKIE, themeClass, type Appearance, type Theme } from '@/lib/theme';

export function MainShell({
  session,
  structure,
  initialTheme,
  children,
}: {
  session: SessionPayload;
  structure: Structure | null;
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  // Apparence de l'appareil, connue une fois la page chargée (libellé du bouton du thème)
  const [systemDark, setSystemDark] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const appearance: Appearance | null =
    theme !== 'systeme' ? theme : systemDark === null ? null : systemDark ? 'sombre' : 'clair';

  // Bascule clair ↔ sombre. Revenir à l'apparence de l'appareil reprend le thème du système.
  const toggleTheme = () => {
    const system: Appearance = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
    const current = theme === 'systeme' ? system : theme;
    const next: Appearance = current === 'clair' ? 'sombre' : 'clair';
    const stored: Theme = next === system ? 'systeme' : next;
    document.cookie =
      stored === 'systeme'
        ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
        : `${THEME_COOKIE}=${stored}; path=/; max-age=31536000; samesite=lax`;
    setTheme(stored);
  };
  const { t } = useT();
  const setActiveStructure = useAppStore(state => state.setActiveStructure);
  const router = useRouter();

  // Une seule source pour les modules : ceux de la licence actuelle (session relue côté serveur).
  useEffect(() => {
    setActiveStructure(structure ? { ...structure, modules: session.modules ?? structure.modules } : null);
  }, [structure, session.modules, setActiveStructure]);

  // Licence modifiée depuis la connexion : on réécrit le cookie pour que les
  // accès (middleware) suivent sans reconnexion.
  const stale = Boolean(session.staleModules);
  useEffect(() => {
    if (!stale) return;
    fetch('/api/session/refresh', { method: 'POST' })
      .then((res) => res.ok && router.refresh())
      .catch(() => undefined);
  }, [stale, router]);

  // Menus, dialogues et listes déroulantes s'affichent hors de ce conteneur
  // (portails) : on active aussi le thème sur la page, le temps du back-office.
  useEffect(() => {
    const root = document.documentElement;
    const cls = themeClass(theme);
    root.classList.add(cls);
    return () => root.classList.remove(cls);
  }, [theme]);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  return (
    // dark ou theme-clair : thème choisi par l'utilisateur pour tout le back-office (voir globals.css)
    <div className={`${themeClass(theme)} flex h-screen bg-slate-950 text-foreground min-h-0 print:bg-white print:text-black print:h-auto print:overflow-visible`}>
      <Sidebar
        session={session}
        structure={structure}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label={t('nav.closeMenu')}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden print:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible print:block">
        <TopNav
          session={session}
          onMenuClick={() => setMobileNavOpen(true)}
          appearance={appearance}
          onToggleTheme={toggleTheme}
        />
        {/* flex-col : la racine de chaque page (flex-1) occupe toute la zone disponible */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-slate-900 print:block print:bg-white print:overflow-visible">{children}</div>
      </main>
    </div>
  );
}
