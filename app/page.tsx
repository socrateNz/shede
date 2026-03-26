import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle,
  ShoppingCart,
  Package,
  Settings,
  TrendingUp,
  Users,
  Coffee,
  Zap,
  Shield,
  BarChart,
  Smartphone,
  Tablet,
  Store,
  Heart,
  Award,
  Headphones,
  QrCode,
  Globe,
  LayoutDashboard,
  Clock,
  Star
} from 'lucide-react';

export default async function HomePage() {
  const session = await getSession();

  // Décommentez cette partie quand vous êtes prêt
  // if (session) {
  //   redirect(session.role === 'SUPER_ADMIN' ? '/structures' : '/dashboard');
  // }

  const features = [
    {
      icon: Tablet,
      title: 'La caisse du futur',
      description: 'Intuitive et connectée, suivez commandes, encaissements, stocks et performances en temps réel depuis votre écran.',
      color: 'text-blue-400',
      badge: 'Incontournable'
    },
    {
      icon: Globe,
      title: 'Commande en ligne',
      description: 'Développez vos ventes avec Click & Collect, livraisons et commandes à emporter, centralisés sur votre caisse.',
      color: 'text-emerald-400',
      badge: '+ de ventes'
    },
    {
      icon: LayoutDashboard,
      title: 'Pilotage multisite',
      description: 'Modifiez cartes, suivez commandes, analysez performances et gérez stocks depuis votre smartphone, à distance.',
      color: 'text-purple-400',
      badge: 'À distance'
    },
    {
      icon: QrCode,
      title: 'Digitalisation complète',
      description: 'Réservations, fidélité, bornes de commande, intégration des livraisons : tout est centralisé.',
      color: 'text-amber-400',
      badge: 'Tout-en-un'
    },
    {
      icon: Headphones,
      title: 'Accompagnement sur mesure',
      description: 'Une équipe camerounaise vous forme et vous conseille par téléphone, email ou chat à chaque étape.',
      color: 'text-rose-400',
      badge: 'Support Camerounais'
    },
    {
      icon: Smartphone,
      title: 'Un écran pour tout gérer',
      description: 'Centralisez tous vos canaux de vente (Click & Collect, livraisons, vente à emporter) sur votre écran Shede.',
      color: 'text-indigo-400',
      badge: 'Simplifié'
    }
  ];

  const benefits = [
    {
      title: 'Trop d\'écrans, trop d\'abonnements ?',
      description: 'Digitalisez votre activité selon vos besoins avec une solution complète et sans engagement dans un seul écran.',
      icon: Smartphone
    },
    {
      title: 'Vous n\'arrivez pas à augmenter votre chiffre ?',
      description: 'Gagnez du temps, de l’argent et concentrez-vous sur votre activité grâce au pilotage à distance et à l’automatisation.',
      icon: TrendingUp
    },
    {
      title: 'Vous manquez de conseil et d\'accompagnement ?',
      description: 'Notre équipe de professionnels, basée en Cameroun, vous accompagne à chaque étape de votre projet.',
      icon: Headphones
    }
  ];

  const stats = [
    { value: '4 000+', label: 'Restaurants équipés', icon: Store },
    { value: '98%', label: 'de clients satisfaits', icon: Star },
    { value: '7j/7', label: 'Accès au support', icon: Clock },
    { value: '+80', label: 'Partenaires intégrés', icon: Zap }
  ];

  const testimonials = [
    {
      name: 'Jean-Christophe Le Ho',
      role: 'Restaurateur multi-sites',
      content: 'Avec Shede, on peut piloter tous nos points de ventes. Le Click&Collect mis en place en 1 mois. Une réactivité exceptionnelle avec des outils simples et efficaces.',
      rating: 5
    },
    {
      name: 'Graffi Rathamohan',
      role: 'Chef d\'entreprise',
      content: 'Shede, c’est canon pour se développer : robuste, bien pensé, fluide. Caisse multisite, fidélité, click’n collect… Nous avons gagné en efficacité et en sérénité.',
      rating: 5
    }
  ];

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section - Shede style with clean white background */}
      <div className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50">
        {/* Navigation */}
        <div className="relative mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2 shadow-md p-2 rounded-xl border border-slate-100">
              <Link href="/dashboard" className="flex items-center gap-2">
                <img src="/logo.webp" alt="Shede" className="w-10 h-10 rounded-lg border border-slate-100" />
                <h1 className="text-xl font-bold text-slate-900">Shede</h1>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-slate-600 px-4 py-2 text-sm font-medium hover:text-slate-900 transition"
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-all duration-200"
              >
                Essai gratuit
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="mt-16 lg:mt-24 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-xs text-blue-700 font-medium">Nouvelle version v2.0</span>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900">
                Digitalisez et pilotez vos{' '}
                <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  restaurants sereinement
                </span>
              </h1>

              <p className="mt-6 text-lg text-slate-600">
                Une solution ultra complète pour remplacer toutes les autres !
                Pensée pour la restauration, Shede couvre tous vos besoins : caisse,
                commande en ligne, pilotage à distance, livraisons et plus encore.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all duration-200 group"
                >
                  Découvrir gratuitement
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="#features"
                  className="inline-flex items-center px-6 py-3 rounded-full border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
                >
                  En savoir plus
                </Link>
              </div>

              <p className="mt-6 text-sm text-slate-500">
                🎉 14 jours d'essai gratuit • Sans carte bancaire • Support inclus
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl" />
              <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 p-4">
                <img
                  src="/dashbard.webp"
                  alt="Shede Dashboard Preview"
                  className="rounded-5xl w-full"
                />
                <div className="absolute -bottom-3 -right-3 bg-white p-2 rounded-xl shadow-lg border border-slate-100">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-slate-600">{"Disponible pour vos restaurants"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 pb-12">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="text-center">
                  <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-full bg-blue-50">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                  <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pain Points Section - Shede style */}
      <div className="py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">
              Pourquoi choisir Shede ?
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Et pourquoi ne pas choisir une solution camerounaise, ultra-complète,
              pensée pour la restauration moderne ?
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div key={index} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">{benefit.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">
              Voici tout ce dont vous avez besoin
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              pour faire décoller vos restos en restant zen
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-xl bg-blue-50 ${feature.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      {feature.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                  <Link
                    href="#"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 mt-4 group-hover:gap-2 transition-all"
                  >
                    Découvrir
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">
              La vérité sort de la bouche des clients
            </h2>
            <div className="flex justify-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">★★★★★</span>
                <span className="text-slate-600 text-sm">4.5/5</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-1 text-yellow-500 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-slate-600 italic mb-6">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-purple-600 to-purple-800">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Dès maintenant
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Contactez-nous pour une démo de notre plateforme et découvrez comment digitaliser
            sans effort vos restaurants et augmenter votre chiffre.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-blue-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 group"
            >
              Démarrer l'essai gratuit
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="https://portfolio-socrate.vercel.app/"
              className="inline-flex items-center px-8 py-3 rounded-full border border-white/30 text-white font-semibold hover:bg-white/10 transition"
            >
              Nous contacter
            </Link>
          </div>
          <p className="mt-6 text-sm text-blue-100">
            Le service commercial vous répond sous 24h • 09 72 53 55 72
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div>
                <Link href="/dashboard" className="flex items-center gap-2">
                  {/* <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div> */}
                  <img src="/logo.webp" alt="Shede" className="w-8 h-8 rounded-lg" />
                  <h1 className="text-xl font-bold text-slate-50">Shede</h1>
                </Link>
              </div>
              <p className="text-sm text-slate-400">
                Assistant caisse restaurant moderne et intuitif.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-slate-300 transition">Fonctionnalités</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Tarifs</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-slate-300 transition">Centre d'aide</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Contact</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Status</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-slate-300 transition">Confidentialité</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Conditions</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Cookies</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-400">
            <p>© 2026 Shede. Tous droits réservés.</p>
            <p className="mt-2 md:mt-0">
              design and developed by{' '}
              <Link href="https://portfolio-socrate.vercel.app/" className="text-slate-300 hover:text-white transition underline">
                Etarcos Dev
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}