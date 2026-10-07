'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionPayload } from '@/lib/auth';
import type { Structure } from '@/lib/supabase';
import { Sidebar } from '@/components/sidebar';
import { TopNav } from '@/components/top-nav';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n/client';

export function MainShell({
  session,
  structure,
  children,
}: {
  session: SessionPayload;
  structure: Structure | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
    <div className="flex h-screen bg-slate-950 min-h-0 print:bg-white print:h-auto print:overflow-visible">
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
        />
        {/* flex-col : la racine de chaque page (flex-1) occupe toute la zone disponible */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-slate-900 print:block print:bg-white print:overflow-visible">{children}</div>
      </main>
    </div>
  );
}
