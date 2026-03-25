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
  Smartphone
} from 'lucide-react';

export default async function HomePage() {
  const session = await getSession();

  // Décommentez cette partie quand vous êtes prêt
  // if (session) {
  //   redirect(session.role === 'SUPER_ADMIN' ? '/structures' : '/dashboard');
  // }

  const features = [
    {
      icon: ShoppingCart,
      title: 'Commandes intuitives',
      description: 'Interface simple et rapide pour prendre les commandes avec gestion des accompagnements en temps réel.',
      color: 'text-blue-400'
    },
    {
      icon: Package,
      title: 'Gestion des produits',
      description: 'Créez et gérez votre catalogue de produits avec prix, catégories et disponibilité.',
      color: 'text-emerald-400'
    },
    {
      icon: Coffee,
      title: 'Accompagnements flexibles',
      description: 'Ajoutez des accompagnements à chaque produit avec contrôle du prix inclus ou non.',
      color: 'text-amber-400'
    },
    {
      icon: TrendingUp,
      title: 'Totaux en temps réel',
      description: 'Calcul automatique des montants avec gestion des options et des suppléments.',
      color: 'text-purple-400'
    },
    {
      icon: BarChart,
      title: 'Statistiques avancées',
      description: 'Suivez vos ventes, produits populaires et tendances avec des graphiques détaillés.',
      color: 'text-rose-400'
    },
    {
      icon: Shield,
      title: 'Sécurisé & fiable',
      description: 'Données protégées et authentification sécurisée pour votre restaurant.',
      color: 'text-indigo-400'
    }
  ];

  const stats = [
    { value: '100+', label: 'Restaurants actifs', icon: Users },
    { value: '10k+', label: 'Commandes traitées', icon: ShoppingCart },
    { value: '99.9%', label: 'Disponibilité', icon: Zap },
    { value: '24/7', label: 'Support', icon: Smartphone }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10" />
        
        <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-8">
          {/* Navigation */}
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                <span className="font-bold text-white text-lg">S</span>
              </div>
              <div>
                <p className="text-xs text-slate-400">Shede</p>
                <h1 className="text-lg font-semibold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                  Assistant Caisse
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm hover:bg-slate-800 transition-all duration-200"
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-sm font-medium shadow-lg shadow-blue-500/25 transition-all duration-200"
              >
                Essai gratuit
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="mt-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="text-xs text-blue-300 font-medium">Nouvelle version v2.0</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                Gérez votre restaurant
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                comme un professionnel
              </span>
            </h1>
            
            <p className="mt-6 text-lg text-slate-300 max-w-2xl mx-auto">
              Gérez produits, commandes et accompagnements en temps réel. 
              Une solution complète pour optimiser votre service en salle et à emporter.
            </p>
            
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 font-medium shadow-lg shadow-blue-500/25 transition-all duration-200 group"
              >
                Commencer maintenant
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center px-6 py-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 font-medium transition-all duration-200"
              >
                En savoir plus
              </Link>
            </div>
            
            <p className="mt-6 text-sm text-slate-400">
              🎉 14 jours d'essai gratuit • Sans carte bancaire • Annulation à tout moment
            </p>
          </div>

          {/* Stats Section */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="text-center p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm">
                  <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-50">{stat.value}</div>
                  <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-24 bg-slate-800/30">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-100">
              Fonctionnalités puissantes
            </h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour gérer efficacement votre restaurant
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="group p-6 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/60 transition-all duration-300"
                >
                  <div className={`p-2 rounded-lg w-fit bg-slate-700/30 mb-4 group-hover:scale-110 transition-transform ${feature.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-100">
              Comment ça fonctionne
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              En quelques étapes simples, commencez à utiliser notre solution
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Créez votre compte',
                description: 'Inscrivez-vous gratuitement et configurez votre restaurant'
              },
              {
                step: '2',
                title: 'Ajoutez vos produits',
                description: 'Importez votre catalogue avec prix, catégories et options'
              },
              {
                step: '3',
                title: 'Commencez à vendre',
                description: 'Prenez vos commandes et gérez votre caisse en temps réel'
              }
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/25 mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-slate-100 mb-3">{item.title}</h3>
                <p className="text-slate-400">{item.description}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+4rem)] w-[calc(100%-8rem)] h-0.5 bg-gradient-to-r from-blue-500/20 to-blue-500/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-100">
            Prêt à optimiser votre gestion ?
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Rejoignez des centaines de restaurateurs qui font confiance à Shede
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 font-medium shadow-lg shadow-blue-500/25 transition-all duration-200 group"
            >
              Commencer l'essai gratuit
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 font-medium transition-all duration-200"
            >
              Contacter un conseiller
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Aucune obligation • Essai gratuit de 14 jours • Support inclus
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="font-bold text-white text-sm">S</span>
                </div>
                <span className="font-semibold text-slate-100">Shede</span>
              </div>
              <p className="text-sm text-slate-400">
                Assistant caisse restaurant moderne et intuitif.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-100 mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-slate-300 transition">Fonctionnalités</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Tarifs</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-100 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-slate-300 transition">Centre d'aide</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Contact</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Status</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-100 mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-slate-300 transition">Confidentialité</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Conditions</Link></li>
                <li><Link href="#" className="hover:text-slate-300 transition">Cookies</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-400">
            <p>© 2024 Shede. Tous droits réservés. Construit pour la caisse restaurant.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}