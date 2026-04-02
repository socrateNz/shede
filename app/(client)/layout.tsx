import Link from "next/link";
import { ShoppingCart } from "lucide-react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b shadow-sm border-slate-200 px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-blue-600 tracking-tight">
          Shede
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/cart" className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
            <ShoppingCart className="w-6 h-6 text-slate-700" />
            {/* We'll add the cart badge via a separate Client Component later */}
          </Link>
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
         <Link href="/cart" className="text-slate-600 text-sm font-medium flex flex-col items-center">
            <span className="text-xl">🛒</span>
            Panier
         </Link>
      </nav>
    </div>
  );
}
