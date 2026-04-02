import { getSession } from '@/lib/auth';
import Link from 'next/link';
import {
  ArrowRight,
  Store,
  UserPlus,
  UtensilsCrossed,
  Bed,
  Globe,
  Smartphone,
  CheckCircle,
  LayoutDashboard,
  WalletCards,
  CalendarCheck,
  Users
} from 'lucide-react';

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="absolute top-0 inset-x-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow-sm border border-slate-200">
            <img src="/logo.webp" alt="Shede" className="w-8 h-8 rounded-lg" />
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Shede</h1>
          </Link>
          <div className="flex items-center gap-3">
            {session ? (
              <Link href={session.role === 'CLIENT' ? '/client' : '/dashboard'} className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition">
                Mon Espace
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-5 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white/80 backdrop-blur rounded-full shadow-sm border border-slate-200 transition">
                  Se connecter
                </Link>
                <Link href="/register-client" className="hidden sm:inline-flex px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-md transition">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section - Version Premium sans CSS personnalisé */}
      <div className="h-screen relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-blue-50 via-white to-purple-50 -z-20" />

        {/* Formes Décoratives avec opacité et blur */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10" />
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10" />

        <div className="mx-auto max-w-7xl px-6 text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-linear-to-r from-amber-50 to-amber-100 border border-amber-200 mb-8 text-sm text-amber-800 font-medium shadow-sm transition-transform hover:scale-105 duration-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            🚀 The All-in-One Booking & POS Platform
          </div>

          {/* Titre Principal */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8">
            <span className="bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              La plateforme qui réunit
            </span>
            <br className="hidden md:block" />
            <span className="inline-block mt-2 bg-linear-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent bg-size-[200%_200%] animate-pulse">
              Professionnels & Clients
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            Que vous souhaitiez gérer votre établissement au doigt et à l'œil ou simplement réserver votre prochaine soirée,
            <span className="font-semibold text-slate-800"> Shede est fait pour vous.</span>
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link
              href="/register-client"
              className="group relative inline-flex items-center gap-2 px-8 py-4 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <UserPlus className="w-5 h-5" />
              <span>Commencer gratuitement</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="#solutions"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-slate-200 hover:border-blue-300 text-slate-700 font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300"
            >
              <Globe className="w-5 h-5" />
              <span>Découvrir nos solutions</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Cartes B2C & B2B */}
      <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-8 -mt-8 mb-24">

        {/* B2C Card - Clients */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
            <Globe className="w-32 h-32 text-purple-600" />
          </div>
          <div className="relative z-10">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <UtensilsCrossed className="w-7 h-7 text-purple-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Pour les Clients</h2>
            <p className="text-slate-600 mb-8 h-20">
              Trouvez les meilleurs restaurants et hôtels autour de vous. Réservez une chambre, commandez votre repas en click & collect ou sur place sans attente.
            </p>

            <ul className="space-y-3 mb-10">
              <li className="flex items-center gap-2 text-slate-700">
                <CheckCircle className="w-5 h-5 text-green-500" /> Réservations Instantanées
              </li>
              <li className="flex items-center gap-2 text-slate-700">
                <CheckCircle className="w-5 h-5 text-green-500" /> Historique & Fidélité
              </li>
              <li className="flex items-center gap-2 text-slate-700">
                <CheckCircle className="w-5 h-5 text-green-500" /> 100% Gratuit pour vous
              </li>
            </ul>

            <Link href="/register-client" className="inline-flex items-center justify-center w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold text-lg transition shadow-lg shadow-purple-200 hover:shadow-xl hover:-translate-y-0.5">
              <UserPlus className="w-5 h-5 mr-2" />
              S'inscrire (C'est gratuit)
            </Link>
          </div>
        </div>

        {/* B2B Card - PROS */}
        <div className="bg-slate-900 rounded-3xl p-8 shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
            <Store className="w-32 h-32 text-blue-400" />
          </div>
          <div className="relative z-10">
            <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <LayoutDashboard className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Pour les Pros</h2>
            <p className="text-slate-400 mb-8 h-20">
              Hôteliers et Restaurateurs : Pilotez votre activité depuis une seule interface (Caisse, PMS, Statistiques, Visibilité).
            </p>

            <ul className="space-y-3 mb-10">
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-5 h-5 text-blue-400" /> Caisse Intelligente (POS)
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-5 h-5 text-blue-400" /> Gestion Hôtelière (PMS)
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-5 h-5 text-blue-400" /> Application Multi-tenant
              </li>
            </ul>

            <Link href="tel:+237656954474" className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-lg transition shadow-lg shadow-blue-900/50 hover:shadow-xl hover:-translate-y-0.5">
              <Store className="w-5 h-5 mr-2" />
              Démarrer mon activité
            </Link>
          </div>
        </div>
      </div>

      {/* Côté Utilisateurs (B2C) Presentation */}
      <div id="solutions" className="py-24 bg-white border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Vivez une meilleure expérience client</h2>
          <p className="text-slate-500 mb-16 max-w-2xl mx-auto">Un seul compte unique (Lambda) pour interagir avec tous vos établissements favoris.</p>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="p-6 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <Bed className="w-10 h-10 text-purple-600 mb-4" />
              <h3 className="font-bold text-lg mb-2">Réservations Hôtelières</h3>
              <p className="text-slate-600 text-sm">Gérez vos séjours, choisissez vos chambres et checkez vos dates de réservation en direct sur la plateforme.</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <Smartphone className="w-10 h-10 text-emerald-600 mb-4" />
              <h3 className="font-bold text-lg mb-2">Commandes à Table & Emporter</h3>
              <p className="text-slate-600 text-sm">Scannez un QR code ou commandez depuis l'appli directement. Fini l'attente en salle ou au téléphone.</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <WalletCards className="w-10 h-10 text-blue-600 mb-4" />
              <h3 className="font-bold text-lg mb-2">Suivi et Historique</h3>
              <p className="text-slate-600 text-sm">Retrouvez toutes vos factures, l'historique de vos menus goûtés et vos lieux favoris dans votre espace.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Côté Pros (B2B) Presentation */}
      <div className="py-24 bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold mb-4">Un logiciel de gestion puissant (SaaS)</h2>
              <p className="text-slate-400 max-w-xl">Plus besoin d'une dizaine d'applications. La plateforme B2B vous offre les clés d'un pilotage complet de votre lieu.</p>
            </div>
            <Link href="tel:+237656954474" className="inline-flex items-center text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap transition-colors">
              Contactez-nous pour une Démo <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl hover:bg-slate-750 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <CalendarCheck className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="font-semibold mb-2">Tableau de bord (PMS)</h3>
              <p className="text-sm text-slate-400">Gérez l'occupation des lits, bloquez les dates et encaissez en quelques clics.</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl hover:bg-slate-750 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <Store className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="font-semibold mb-2">Caisse Tactile</h3>
              <p className="text-sm text-slate-400">Module de caisse restaurant ultra-rapide avec gestion des serveurs.</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl hover:bg-slate-750 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <Users className="w-8 h-8 text-purple-400 mb-4" />
              <h3 className="font-semibold mb-2">Rôles Multiples</h3>
              <p className="text-sm text-slate-400">Permissions granulaires (Réception, Serveur, Admin, Caisse) par accès.</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl hover:bg-slate-750 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <Globe className="w-8 h-8 text-amber-400 mb-4" />
              <h3 className="font-semibold mb-2">Visibilité Web</h3>
              <p className="text-sm text-slate-400">Votre structure s'affiche automatiquement aux clients inscrits sur Shede.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black py-12 text-center text-slate-500">
        <p>© 2026 Shede Tech. Tous droits réservés.</p>
        <p className="mt-2">Design and build by <Link href="https://portfolio-socrate.vercel.app/" className="text-blue-600 font-semibold hover:underline transition-colors">Etarcos Dev</Link></p>
      </footer>
    </main>
  );
}