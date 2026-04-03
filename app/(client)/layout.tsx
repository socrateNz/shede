import Link from "next/link";
import { CartBadge } from "@/components/cart-badge";
import { ClientLogout } from "@/components/client-logout";
import { getSession } from "@/lib/auth";
import { UserCircle, CalendarDays } from "lucide-react";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b shadow-sm border-slate-200 px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow-sm border border-slate-200">
          <img src="/logo.webp" alt="Shede" className="w-8 h-8 rounded-lg" />
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Shede</h1>
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          {session ? (
            <div className="flex items-center gap-1 md:gap-3 mr-2 border-r border-slate-200 pr-3 md:pr-4">
              <Link href="/history" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <CalendarDays className="w-4 h-4" />
                <span className="hidden sm:inline">Historique</span>
              </Link>
              <Link href="/client" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <UserCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Mon Espace</span>
              </Link>
              <ClientLogout />
            </div>
          ) : (
            <div className="flex items-center mr-2 border-r border-slate-200 pr-3 md:pr-4">
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">
                Se connecter
              </Link>
            </div>
          )}
          <CartBadge />
        </div>
      </header>
      <main className="flex-1 pb-16">
        {children}
      </main>

      {/* Mobile Bottom Navigation (optional but requested mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t flex items-center justify-around md:hidden px-4 z-50">
        <Link href="/" className="text-slate-600 text-sm font-medium flex flex-col items-center">
          <span className="text-xl">🏠</span>
          Accueil
        </Link>
        {session && (
          <>
            <Link href="/history" className="text-slate-600 text-sm font-medium flex flex-col items-center">
              <span className="text-xl">📅</span>
              Historique
            </Link>
            <Link href="/client" className="text-slate-600 text-sm font-medium flex flex-col items-center">
              <span className="text-xl">👤</span>
              Espace
            </Link>
          </>
        )}
        <CartBadge mobile />
      </nav>
    </div>
  );
}
