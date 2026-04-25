import Link from "next/link";
import { CartBadge } from "@/components/cart-badge";
import { ClientLogout } from "@/components/client-logout";
import { getSession } from "@/lib/auth";
import { UserCircle, CalendarDays, Home, ShoppingBag, Sparkles } from "lucide-react";
import { MobileNavItem } from "@/components/mobile-nav-item";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50 flex flex-col overflow-y-auto">
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100 px-4 lg:px-6 h-16 flex items-center justify-between transition-all duration-300">
        {/* Logo avec effet moderne */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-300 hover:shadow-md"
        >
          <div className="relative">
            <img src="/logo.webp" alt="Shede" className="w-8 h-8 rounded-lg transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 rounded-lg bg-linear-to-tr from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <h1 className="text-xl font-bold bg-linear-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            Shede
          </h1>
        </Link>

        {/* Actions principales */}
        <div className="flex items-center gap-1 md:gap-3">
          {session ? (
            <>
              <div className="hidden md:flex items-center gap-1 mr-2 border-r border-slate-200 pr-4">
                <NavLink href="/history" icon={<CalendarDays className="w-4 h-4" />} label="Historique" />
                <NavLink href="/client" icon={<UserCircle className="w-4 h-4" />} label="Mon Espace" />
              </div>
              <ClientLogout />
            </>
          ) : (
            <div className="hidden md:block mr-2">
              <Link
                href="/login"
                className="relative px-5 py-2 text-sm font-semibold text-white bg-linear-to-r from-blue-600 to-blue-500 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                Se connecter
              </Link>
            </div>
          )}
          <CartBadge />
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 pb-20 md:pb-8">
        {children}
      </main>

      {/* Navigation mobile moderne - Bottom Bar avec effet glassmorphism */}
      <nav className="fixed bottom-3 left-3 right-3 md:hidden bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-lg flex items-center justify-around px-2 py-2 z-50 transition-all duration-300">
        <MobileNavItem href="/" icon={<Home className="w-5 h-5" />} label="Accueil" exact />
        {session && (
          <>
            <MobileNavItem href="/history" icon={<CalendarDays className="w-5 h-5" />} label="Historique" />
            <MobileNavItem href="/client" icon={<UserCircle className="w-5 h-5" />} label="Espace" />
          </>
        )}
        <div className="relative">
          <CartBadge mobile />
        </div>
      </nav>
    </div>
  );
}

// Composant réutilisable pour une meilleure organisation (Server side ok car pas de hooks)
function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg transition-all duration-200 hover:text-blue-600 hover:bg-blue-50/80 hover:scale-105 active:scale-95"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}