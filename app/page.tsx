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
  CalendarCheck,
  Users,
  Tag,
  Package,
  TrendingUp,
  Shield,
  Zap,
  CreditCard,
  QrCode,
  BarChart3,
  Star,
  Heart,
  Store as StoreIcon,
} from 'lucide-react';
import LogoCarousel from '@/app/components/LogoCarousel';

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="min-h-screen bg-[#fdfdff]">
      {/* Navigation - Gardée identique */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center group">
            <div className="p-1.5 rounded-lg group-hover:rotate-6 transition-transform">
              <img src="/logo.webp" alt="Shede" className="w-8 h-8 border-2 border-purple-600 rounded-lg" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shede</h1>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#product" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Produit</Link>
            <Link href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Fonctionnalités</Link>
            <Link href="#solutions" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Solutions</Link>
            <Link href="#team" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Équipe</Link>
            <Link href="#contact" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Contact</Link>
          </div>

          <div className="flex items-center gap-4">
            {session ? (
              <Link href={session.role === 'CLIENT' ? '/client' : '/dashboard'} className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-md transition">
                Mon Espace
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                  Se connecter
                </Link>
                <Link href="/register-client" className="hidden sm:inline-flex px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 transition hover:-translate-y-0.5">
                  Commencer
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section - Version que vous avez validée */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-40 overflow-hidden bg-[#fdfdff]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-200/30 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-100/30 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 -z-10" />

        <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10 text-left">
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-8">
              Managez <span className="text-purple-600">intelligemment</span> vos opérations.
              <span className="block mt-4 text-purple-900 italic font-serif font-light tracking-normal">Propulser votre croissance.</span>
            </h1>
            <p className="text-lg text-slate-500 mb-10 leading-relaxed max-w-lg">
              Débloquez des opérations fluides avec un système conçu pour améliorer la productivité, ravir les clients et garder votre équipe motivée.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="tel:+237656954474"
                className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Parlons-en avec un expert
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative bg-purple-600 rounded-[2.5rem] p-6 lg:p-8 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="relative group perspective-1000">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                  <img
                    src="/hero-mockup.png"
                    alt="Shede Dashboard Mockup"
                    className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 -z-10 animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-400/20 blur-3xl rounded-full" />
              </div>
            </div>
          </div>
        </div>

        <LogoCarousel />

      </div>

      {/* Section Solutions Principales - Style harmonisé */}
      <div id="solutions" className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Pour les <span className="text-purple-600">clients</span> et les <span className="text-purple-600">professionnels</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Une plateforme unifiée qui connecte les établissements avec leurs clients pour une expérience fluide et efficace.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Carte Client */}
            <div className="group bg-gradient-to-br from-white to-purple-50/30 rounded-3xl p-8 border border-purple-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Expérience Client Premium</h3>
              <p className="text-slate-600 mb-6">
                Une application intuitive pour découvrir, réserver et profiter des meilleurs établissements sans complication.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "Réservations instantanées sans commission",
                  "Programme de fidélité intégré",
                  "Scan & Order - Plus d'attente",
                  "Offres exclusives et cashback"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/register-client"
                className="inline-flex items-center justify-between w-full bg-purple-600 hover:bg-purple-700 text-white py-3.5 px-6 rounded-xl font-semibold transition-all group-hover:shadow-lg"
              >
                <span>Je suis client</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Carte Professionnel */}
            <div className="group bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 border border-slate-700 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <LayoutDashboard className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Solution Professionnelle</h3>
              <p className="text-slate-400 mb-6">
                Une plateforme tout-en-un pour gérer vos opérations, maximiser votre rentabilité et fidéliser vos clients.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  "POS intelligent + gestion des stocks",
                  "PMS complet pour hôtels",
                  "Analytics avancés en temps réel",
                  "Application menu digital personnalisable"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/register-business"
                className="inline-flex items-center justify-between w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 px-6 rounded-xl font-semibold transition-all group-hover:shadow-lg"
              >
                <span>Je suis professionnel</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Section Fonctionnalités Clés */}
      <div id="features" className="py-24 bg-gradient-to-b from-white to-purple-50/20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Des fonctionnalités <span className="text-purple-600">puissantes</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour gérer votre établissement efficacement
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: UtensilsCrossed, title: "Gestion Restaurant (POS)", desc: "Prise de commande intuitive, suivi en temps réel et intégration cuisine", color: "from-orange-500 to-orange-600" },
              { icon: Bed, title: "Gestion Hôtelière (PMS)", desc: "Planning des réservations, gestion des chambres et facturation centralisée", color: "from-purple-500 to-purple-600" },
              { icon: Package, title: "Gestion des Stocks", desc: "Contrôle en temps réel, alertes de rupture et optimisation des commandes", color: "from-emerald-500 to-emerald-600" },
              { icon: QrCode, title: "Scan & Order", desc: "QR code à table pour commander sans attente, paiement mobile intégré", color: "from-blue-500 to-blue-600" },
              { icon: TrendingUp, title: "Analytics Avancés", desc: "Tableaux de bord personnalisables et rapports détaillés en temps réel", color: "from-cyan-500 to-cyan-600" },
              { icon: Shield, title: "Sécurité Maximale", desc: "Données cryptées, conformité RGPD et backups automatiques", color: "from-indigo-500 to-indigo-600" }
            ].map((feature, idx) => (
              <div key={idx} className="group bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-md`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section Avantages */}
      <div className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">
                Une plateforme qui <span className="text-purple-600">évolue avec vous</span>
              </h2>
              <p className="text-slate-600 mb-8">
                Que vous soyez un petit établissement ou une chaîne hôtelière, notre solution s'adapte à vos besoins et grandit avec votre activité.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Zap, title: "Prise en main rapide", desc: "Interface intuitive et formation incluse" },
                  { icon: CreditCard, title: "Paiements intégrés", desc: "Multiple moyens de paiement acceptés" },
                  { icon: Heart, title: "Support dédié 24/7", desc: "Une équipe à votre écoute en permanence" }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-xl bg-slate-50 hover:bg-purple-50 transition-colors">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-200 to-purple-100 rounded-3xl blur-3xl opacity-30" />
              <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 border border-slate-700">
                <div className="text-center mb-6">
                  <div className="text-4xl font-bold text-white mb-2">+98%</div>
                  <div className="text-slate-400">de satisfaction client</div>
                </div>
                <div className="h-px bg-slate-700 my-6" />
                <div className="space-y-4">
                  {[
                    { value: "50k+", label: "Clients actifs" },
                    { value: "500+", label: "Établissements" },
                    { value: "99.9%", label: "Disponibilité" }
                  ].map((stat, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-400">{stat.label}</span>
                      <span className="text-white font-bold text-lg">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Témoignages */}
      <div className="py-24 bg-gradient-to-b from-purple-50/20 to-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Ce qu'ils <span className="text-purple-600">disent de nous</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Découvrez les retours d'expérience de nos utilisateurs
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Sophie Martin", role: "Restauratrice", content: "Shede a transformé la gestion de mon restaurant. Le POS est incroyablement intuitif et mes clients adorent le système de commande par QR code." },
              { name: "Thomas Dubois", role: "Directeur d'hôtel", content: "La gestion des réservations et des chambres n'a jamais été aussi simple. Un gain de temps considérable pour mon équipe." },
              { name: "Marie Lambert", role: "Chef d'entreprise", content: "Plateforme multi-tenant parfaite pour gérer mes différents établissements. Je recommande vivement !" }
            ].map((testimonial, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg hover:shadow-xl transition-all">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-purple-500 text-purple-500" />
                  ))}
                </div>
                <p className="text-slate-600 mb-6 italic">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-purple-600">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section CTA Finale */}
      <div className="py-24 bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Prêt à <span className="text-purple-400">transformer</span> votre activité ?
          </h2>
          <p className="text-lg text-slate-300 mb-10">
            Rejoignez les centaines d'établissements qui nous font confiance et découvrez la différence Shede.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register-business"
              className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all hover:scale-105"
            >
              <Store className="w-5 h-5" />
              Commencer maintenant
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 border-2 border-purple-500 text-purple-400 font-semibold rounded-xl hover:bg-purple-600/10 transition-all"
            >
              <CalendarCheck className="w-5 h-5" />
              Planifier une démo
            </Link>
          </div>
        </div>
      </div>

      {/* Footer modernisé */}
      <footer className="bg-slate-900 py-12 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.webp" alt="Shede" className="w-8 h-8 border-2 border-purple-600 rounded-lg" />
                <span className="text-white font-bold text-xl">Shede</span>
              </div>
              <p className="text-slate-400 text-sm">
                La plateforme qui révolutionne la gestion des établissements.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#features" className="hover:text-purple-400 transition">Fonctionnalités</Link></li>
                <li><Link href="#solutions" className="hover:text-purple-400 transition">Solutions</Link></li>
                <li><Link href="tel:+237656954474" className="hover:text-purple-400 transition">Tarifs</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/docs" className="hover:text-purple-400 transition">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="tel:+237656954474" className="hover:text-purple-400 transition">+237 656 954 474</Link></li>
                <li><Link href="https://portfolio-socrate.vercel.app/" className="hover:text-purple-400 transition">Etarcos Dev</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center">
            <p className="text-slate-500 text-sm">© 2026 Shede Tech. Tous droits réservés.</p>
            <p className="text-slate-500 text-sm mt-2">
              Design by <Link href="https://portfolio-socrate.vercel.app/" className="text-purple-400 hover:text-purple-300 transition">Etarcos Dev</Link>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}