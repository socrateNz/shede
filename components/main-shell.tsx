'use client';

import { useEffect, useState } from 'react';
import type { SessionPayload } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { TopNav } from '@/components/top-nav';

export function MainShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    <div className="flex h-screen bg-slate-950 min-h-0">
      <Sidebar
        session={session}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopNav
          session={session}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <div className="min-h-0 flex-1 overflow-auto bg-slate-900">{children}</div>
      </main>
    </div>
  );
}
