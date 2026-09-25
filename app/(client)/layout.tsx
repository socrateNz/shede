import Link from "next/link";
import { CartBadge } from "@/components/cart-badge";
import { ClientLogout } from "@/components/client-logout";
import { getSession } from "@/lib/auth";
import { UserCircle, CalendarDays, Home, Store } from "lucide-react";
import { MobileNavItem } from "@/components/mobile-nav-item";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const { t } = await getT();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-y-auto selection:bg-blue-200">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 px-4 lg:px-8 h-20 flex items-center justify-between transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        {/* Logo avec effet moderne */}
        <Link
          href="/"
          className="group flex items-center gap-3 px-2 py-2 rounded-2xl transition-all duration-300 hover:bg-slate-50"
        >
          <div className="relative">
            <img src="/logo.webp" alt="Shede" className="w-10 h-10 rounded-xl shadow-sm transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight group-hover:from-blue-700 group-hover:to-purple-700 transition-all duration-500">
            Shede
          </h1>
        </Link>

        {/* Actions principales */}
        <div className="flex items-center gap-2 md:gap-4">
          <LanguageSwitcher tone="light" />
          {session ? (
            <>
              <div className="hidden md:flex items-center gap-2 mr-2 border-r border-slate-200/80 pr-6">
                <NavLink href="/client/structures" icon={<Store className="w-4 h-4" />} label={t('client.nav.catalogue')} />
                <NavLink href="/history" icon={<CalendarDays className="w-4 h-4" />} label={t('client.nav.history')} />
                <NavLink href="/client" icon={<UserCircle className="w-4 h-4" />} label={t('client.nav.mySpace')} />
              </div>
              <ClientLogout />
            </>
          ) : (
            <div className="hidden md:block mr-2">
              <Link
                href="/login"
                className="relative px-6 py-2.5 text-sm font-bold text-white bg-slate-900 rounded-full transition-all duration-300 hover:bg-blue-600 shadow-md hover:shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                {t('client.nav.signIn')}
              </Link>
            </div>
          )}
          <CartBadge />
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 pb-24 md:pb-8">
        {children}
      </main>

      {/* Navigation mobile moderne - Bottom Bar avec effet glassmorphism premium */}
      <nav className="fixed bottom-4 left-4 right-4 md:hidden bg-white/90 backdrop-blur-2xl border border-white/40 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] flex items-center justify-around px-3 py-3 z-50 transition-all duration-300">
        <MobileNavItem href="/" icon={<Home className="w-5 h-5" />} label={t('client.nav.home')} exact />
        {session && (
          <>
            <MobileNavItem href="/client/structures" icon={<Store className="w-5 h-5" />} label={t('client.nav.catalogue')} />
            <MobileNavItem href="/history" icon={<CalendarDays className="w-5 h-5" />} label={t('client.nav.history')} />
            <MobileNavItem href="/client" icon={<UserCircle className="w-5 h-5" />} label={t('client.nav.space')} />
          </>
        )}
        <div className="relative">
          <CartBadge mobile />
        </div>
      </nav>
    </div>
  );
}

// Composant réutilisable pour une meilleure organisation
function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-500 rounded-full transition-all duration-300 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}