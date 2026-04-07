'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  BookOpen,
  Zap,
  UtensilsCrossed,
  Bed,
  QrCode,
  BarChart3,
  Shield,
  Users,
  Settings,
  Package,
  ChevronRight,
  ChevronDown,
  Search,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  LayoutDashboard,
  CreditCard,
  Globe,
  Smartphone,
  Tag,
  CalendarCheck,
  Star,
  Terminal,
  FileText,
  HelpCircle,
  Menu,
  X,
} from 'lucide-react';

/* ─────────────────────────────────────────
   DATA
───────────────────────────────────────── */

const navSections = [
  {
    title: 'Démarrage',
    icon: Zap,
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'quickstart', label: 'Démarrage rapide' },
      { id: 'architecture', label: 'Architecture' },
    ],
  },
  {
    title: 'Côté Client (B2C)',
    icon: Users,
    items: [
      { id: 'client-account', label: 'Compte client' },
      { id: 'client-reservations', label: 'Réservations' },
      { id: 'client-orders', label: 'Commandes & QR Code' },
      { id: 'client-fidelite', label: 'Fidélité & Promos' },
    ],
  },
  {
    title: 'Côté Professionnel (B2B)',
    icon: LayoutDashboard,
    items: [
      { id: 'pro-dashboard', label: 'Tableau de bord' },
      { id: 'pro-pos', label: 'Caisse (POS)' },
      { id: 'pro-pms', label: 'Gestion Hôtelière (PMS)' },
      { id: 'pro-stocks', label: 'Stocks & Catalogue' },
      { id: 'pro-promos', label: 'Promotions' },
      { id: 'pro-analytics', label: 'Analytics' },
    ],
  },
  {
    title: 'Rôles & Permissions',
    icon: Shield,
    items: [
      { id: 'roles-overview', label: "Vue d'ensemble" },
      { id: 'roles-admin', label: 'Super Admin' },
      { id: 'roles-cashier', label: 'Caissier' },
      { id: 'roles-server', label: 'Serveur' },
    ],
  },
  {
    title: 'Intégrations',
    icon: Globe,
    items: [
      { id: 'integrations-qr', label: 'QR Code & Self-Order' },
      { id: 'integrations-payment', label: 'Paiements' },
    ],
  },
  {
    title: 'Support',
    icon: HelpCircle,
    items: [
      { id: 'faq', label: 'FAQ' },
      { id: 'contact-support', label: 'Contacter le support' },
    ],
  },
];

/* ─────────────────────────────────────────
   CODE BLOCK COMPONENT
───────────────────────────────────────── */
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative my-4 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800">
        <span className="text-xs font-mono text-slate-400">{language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>
      <pre className="p-4 text-sm text-slate-300 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

/* ─────────────────────────────────────────
   CALLOUT COMPONENT
───────────────────────────────────────── */
function Callout({ type = 'info', children }: { type?: 'info' | 'warning' | 'tip' | 'danger'; children: React.ReactNode }) {
  const styles = {
    info: { bg: 'bg-blue-50 border-blue-200', icon: '💡', text: 'text-blue-800' },
    warning: { bg: 'bg-amber-50 border-amber-200', icon: '⚠️', text: 'text-amber-800' },
    tip: { bg: 'bg-green-50 border-green-200', icon: '✅', text: 'text-green-800' },
    danger: { bg: 'bg-red-50 border-red-200', icon: '🚨', text: 'text-red-800' },
  }[type];
  return (
    <div className={`flex gap-3 p-4 rounded-xl border my-4 ${styles.bg}`}>
      <span className="text-lg leading-none mt-0.5">{styles.icon}</span>
      <p className={`text-sm ${styles.text}`}>{children}</p>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction');
  const [openSections, setOpenSections] = useState<string[]>(['Démarrage', 'Côté Client (B2C)', 'Côté Professionnel (B2B)']);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (title: string) => {
    setOpenSections(prev =>
      prev.includes(title) ? prev.filter(s => s !== title) : [...prev, title]
    );
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#fdfdff] flex flex-col">
      {/* ── Top Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 h-16">
        <div className="mx-auto max-w-screen-xl px-4 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2 group">
              <img src="/logo.webp" alt="Shede" className="w-7 h-7 border-2 border-purple-600 rounded-lg" />
              <span className="font-bold text-slate-900 text-lg">Shede</span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1 text-sm text-slate-400">
              <ChevronRight className="w-4 h-4" /> Documentation
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-sm bg-slate-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Rechercher dans la doc…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </Link>
            <Link
              href="/register-client"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-md transition hover:-translate-y-0.5"
            >
              Commencer
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        {/* ── Sidebar ── */}
        <aside
          className={`
            fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] z-40
            w-72 bg-white border-r border-slate-200 overflow-y-auto
            transition-transform duration-300 lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            flex flex-col
          `}
        >
          <div className="p-4 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">Navigation</p>
            {navSections.map((section) => {
              const isOpen = openSections.includes(section.title);
              return (
                <div key={section.title} className="mb-2">
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700 transition"
                  >
                    <div className="flex items-center gap-2">
                      <section.icon className="w-4 h-4 text-purple-500" />
                      {section.title}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  </button>
                  {isOpen && (
                    <div className="mt-1 ml-4 border-l border-slate-200 pl-3 space-y-0.5">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => scrollTo(item.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all ${activeSection === item.id
                              ? 'bg-purple-50 text-purple-700 font-semibold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-slate-100">
            <a
              href="tel:+237656954474"
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 transition font-medium"
            >
              <HelpCircle className="w-4 h-4" /> Besoin d'aide ? Appelez-nous
            </a>
          </div>
        </aside>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 px-4 sm:px-10 py-12 max-w-3xl mx-auto">

          {/* ── INTRODUCTION ── */}
          <section id="introduction" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <BookOpen className="w-3.5 h-3.5" /> Documentation
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
              Bienvenue sur <span className="text-purple-600">Shede</span>
            </h1>
            <p className="text-lg text-slate-500 mb-6 leading-relaxed">
              Shede est une plateforme SaaS multi-tenant conçue pour les hôtels et restaurants. Elle connecte les
              professionnels de l'hôtellerie-restauration avec leurs clients via une interface unifiée, intuitive
              et puissante.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: UtensilsCrossed, title: 'Restaurants', desc: 'POS, commandes, stocks', color: 'text-orange-500 bg-orange-50' },
                { icon: Bed, title: 'Hôtels', desc: 'PMS, réservations chambres', color: 'text-purple-500 bg-purple-50' },
                { icon: Users, title: 'Clients B2C', desc: 'App & Portail client', color: 'text-blue-500 bg-blue-50' },
              ].map((card) => (
                <div key={card.title} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{card.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{card.desc}</p>
                </div>
              ))}
            </div>

            <Callout type="info">
              Cette documentation couvre l'ensemble des fonctionnalités de Shede. Naviguez via la barre latérale ou
              utilisez la recherche pour trouver rapidement ce dont vous avez besoin.
            </Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── QUICKSTART ── */}
          <section id="quickstart" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Zap className="w-7 h-7 text-yellow-500" /> Démarrage rapide
            </h2>
            <p className="text-slate-500 mb-6">Créez votre compte et commencez à utiliser Shede en moins de 5 minutes.</p>

            <div className="space-y-4">
              {[
                { step: '01', title: 'Créer un compte', desc: "Rendez-vous sur /register-client (client) ou contactez-nous pour un compte professionnel." },
                { step: '02', title: 'Configurer votre établissement', desc: 'Renseignez le nom, le type (Restaurant / Hôtel / Mixte), les horaires et le logo.' },
                { step: '03', title: 'Inviter votre équipe', desc: 'Ajoutez vos collaborateurs avec les bons rôles : Admin, Caissier ou Serveur.' },
                { step: '04', title: 'Lancer les opérations', desc: "Votre caisse est prête, vos QR codes générés. C'est parti !" },
              ].map((item) => (
                <div key={item.step} className="flex gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── ARCHITECTURE ── */}
          <section id="architecture" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Architecture</h2>
            <p className="text-slate-500 mb-6">Shede repose sur une architecture multi-tenant moderne.</p>

            <div className="bg-slate-900 text-slate-300 rounded-2xl p-6 font-mono text-sm leading-loose border border-slate-700 mb-6">
              <div className="text-green-400 font-bold mb-2"># Structure des rôles</div>
              <div><span className="text-purple-400">SUPER_ADMIN</span>  →  Gère toutes les structures</div>
              <div className="ml-4"><span className="text-blue-400">ADMIN</span>       →  Gère son établissement</div>
              <div className="ml-8"><span className="text-yellow-400">CASHIER</span>    →  Caisse & paiements</div>
              <div className="ml-8"><span className="text-cyan-400">SERVER</span>     →  Commandes (sans paiement)</div>
              <div className="ml-4"><span className="text-pink-400">CLIENT</span>      →  Portail B2C</div>
            </div>

            <Callout type="tip">
              Chaque établissement est cloisonné : les données d'une structure ne sont jamais accessibles par une autre structure, même sous le même Super Admin.
            </Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CLIENT ACCOUNT ── */}
          <section id="client-account" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <Users className="w-3.5 h-3.5" /> Côté Client
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Compte client</h2>
            <p className="text-slate-500 mb-6">
              Le compte client (Lambda) est gratuit et donne accès à tous les établissements partenaires Shede.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "Inscription via /register-client",
                "Connexion avec email + mot de passe",
                "Profil personnalisable (nom, photo, préférences)",
                "Historique de toutes les commandes & réservations",
                "Accès aux réductions et au programme de fidélité",
              ].map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> {it}
                </li>
              ))}
            </ul>
            <CodeBlock
              language="URL"
              code={`GET /client            → Tableau de bord client
GET /client/orders     → Historique des commandes
GET /client/bookings   → Mes réservations hôtelières`}
            />
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CLIENT RESERVATIONS ── */}
          <section id="client-reservations" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Réservations</h2>
            <p className="text-slate-500 mb-6">
              Réservez une chambre en quelques secondes depuis le portail client ou l'application.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {[
                { icon: CalendarCheck, title: 'Calendrier en temps réel', desc: 'Disponibilité des chambres mise à jour instantanément.' },
                { icon: CreditCard, title: 'Pré-paiement sécurisé', desc: "Règlement en ligne optionnel selon l'hôtel." },
                { icon: Smartphone, title: 'Confirmation mobile', desc: 'Notification immédiate après la réservation.' },
                { icon: FileText, title: 'e-Reçu PDF', desc: 'Justificatif téléchargeable depuis la réservation.' },
              ].map((it) => (
                <div key={it.title} className="flex gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <it.icon className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{it.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{it.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="warning">
              Les annulations sont soumises à la politique de chaque hôtel. Vérifiez les conditions avant de confirmer.
            </Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CLIENT ORDERS & QR ── */}
          <section id="client-orders" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Commandes & QR Code</h2>
            <p className="text-slate-500 mb-6">
              Scannez le QR code à votre table ou à la réception pour commander sans attendre.
            </p>
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-center gap-3 mb-4">
                <QrCode className="w-8 h-8" />
                <div>
                  <p className="font-bold text-lg">Scan & Order</p>
                  <p className="text-purple-200 text-sm">Zero contact, 100% autonomie</p>
                </div>
              </div>
              <ol className="space-y-2 text-sm text-purple-100">
                <li className="flex gap-2"><span className="font-bold text-white">1.</span> Scanner le QR code à votre table</li>
                <li className="flex gap-2"><span className="font-bold text-white">2.</span> Parcourir le menu digital</li>
                <li className="flex gap-2"><span className="font-bold text-white">3.</span> Ajouter au panier et confirmer</li>
                <li className="flex gap-2"><span className="font-bold text-white">4.</span> Suivre l'état en temps réel</li>
              </ol>
            </div>
            <CodeBlock
              language="Workflow commande"
              code={`En attente → En préparation → Prête → Servie`}
            />
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CLIENT FIDELITE ── */}
          <section id="client-fidelite" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Fidélité & Promotions</h2>
            <p className="text-slate-500 mb-6">
              Profitez d'offres exclusives, de réductions automatiques et d'un programme de fidélité intégré.
            </p>
            <div className="space-y-3">
              {[
                { icon: Star, label: 'Programme de points', desc: 'Gagnez des points à chaque commande, échangeables contre des réductions.' },
                { icon: Tag, label: 'Promotions ciblées', desc: 'Des offres personnalisées selon vos habitudes et préférences.' },
                { icon: CreditCard, label: 'Cashback automatique', desc: 'Remboursement automatique sur votre prochaine commande.' },
              ].map((it) => (
                <div key={it.label} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition">
                  <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <it.icon className="w-4.5 h-4.5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{it.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{it.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO DASHBOARD ── */}
          <section id="pro-dashboard" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-200 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <LayoutDashboard className="w-3.5 h-3.5" /> Professionnel
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Tableau de bord</h2>
            <p className="text-slate-500 mb-6">
              Un hub centralisé pour piloter toute votre activité en temps réel.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {[
                "Chiffre d'affaires du jour / semaine / mois",
                "Nombre de commandes en cours",
                "Taux d'occupation des chambres",
                "Alertes stock et notifications équipe",
                "Top produits & meilleures ventes",
                "Commandes par canal (salle, room service, QR)",
              ].map((it) => (
                <div key={it} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-700">
                  <BarChart3 className="w-4 h-4 text-purple-500 flex-shrink-0" /> {it}
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO POS ── */}
          <section id="pro-pos" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Caisse intelligente (POS)</h2>
            <p className="text-slate-500 mb-6">
              Un système de caisse tactile conçu pour la rapidité et la fiabilité en restaurant.
            </p>
            <CodeBlock
              language="Workflow POS"
              code={`1. Sélectionner une table / commander en emporté
2. Ajouter des articles depuis le catalogue
3. Appliquer des promotions ou remises
4. Envoyer en cuisine (ticket imprimé automatiquement)
5. Marquer comme : Prête → Servie
6. Encaisser : Espèces / Mobile Money / Carte`}
            />
            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              {[
                { icon: UtensilsCrossed, label: 'Menu digital' },
                { icon: Package, label: 'Gestion des formules' },
                { icon: Tag, label: 'Réductions & Promos' },
              ].map((it) => (
                <div key={it.label} className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-100 rounded-xl text-sm font-medium text-orange-700">
                  <it.icon className="w-4 h-4" /> {it.label}
                </div>
              ))}
            </div>
            <Callout type="info">
              Seuls les rôles Admin et Caissier peuvent finaliser un paiement. Les Serveurs peuvent prendre des commandes mais pas encaisser.
            </Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO PMS ── */}
          <section id="pro-pms" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Gestion hôtelière (PMS)</h2>
            <p className="text-slate-500 mb-6">
              Gérez l'intégralité du cycle de vie de vos chambres depuis une seule interface.
            </p>
            <div className="space-y-3 mb-6">
              {[
                { status: 'Disponible', color: 'bg-green-500', desc: 'La chambre est libre et peut être réservée.' },
                { status: 'Occupée', color: 'bg-red-500', desc: 'Un client est actuellement en séjour.' },
                { status: 'Réservée', color: 'bg-yellow-500', desc: 'Une réservation confirmée est en attente d\'arrivée.' },
                { status: 'En nettoyage', color: 'bg-blue-500', desc: 'La chambre est en cours de préparation.' },
              ].map((it) => (
                <div key={it.status} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                  <div className={`w-3 h-3 rounded-full ${it.color} flex-shrink-0`} />
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{it.status}</p>
                    <p className="text-xs text-slate-500">{it.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO STOCKS ── */}
          <section id="pro-stocks" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Stocks & Catalogue</h2>
            <p className="text-slate-500 mb-6">Gérez vos produits, catégories et niveaux de stock en temps réel.</p>
            <CodeBlock
              language="Catalogue — structure"
              code={`Catégorie
  └── Produit
        ├── Nom, Description, Prix
        ├── Image
        ├── Stock actuel / Seuil d'alerte
        └── Statut : Disponible | Épuisé | Masqué`}
            />
            <Callout type="warning">
              Quand le stock d'un produit atteint le seuil d'alerte configuré, une notification automatique est
              envoyée à l'Admin.
            </Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO PROMOS ── */}
          <section id="pro-promos" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Promotions</h2>
            <p className="text-slate-500 mb-6">Créez et gérez des promotions pour dynamiser vos ventes.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: 'Promotion globale', desc: 'Réduction appliquée à tout le panier. Visible par tous les clients.' },
                { title: 'Réduction produit', desc: 'Remise ciblée sur un ou plusieurs produits spécifiques.' },
                { title: 'Code promo', desc: "Un code unique à saisir au moment du paiement pour bénéficier d'une remise." },
                { title: 'Promotion temporaire', desc: 'Active uniquement pendant une plage horaire définie (Happy Hour, etc.).' },
              ].map((it) => (
                <div key={it.title} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                  <p className="font-semibold text-sm text-slate-900 mb-1">{it.title}</p>
                  <p className="text-xs text-slate-500">{it.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO ANALYTICS ── */}
          <section id="pro-analytics" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Analytics</h2>
            <p className="text-slate-500 mb-6">
              Des rapports complets pour comprendre et optimiser vos performances.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {[
                { value: 'J / S / M', label: 'Filtres temporels' },
                { value: 'CSV / PDF', label: 'Export de rapports' },
                { value: 'Temps réel', label: 'Mise à jour des données' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xl font-bold text-purple-600 mb-1">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── ROLES OVERVIEW ── */}
          <section id="roles-overview" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <Shield className="w-3.5 h-3.5" /> Sécurité & Accès
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Rôles & Permissions</h2>
            <p className="text-slate-500 mb-6">
              Shede applique un contrôle d'accès strict basé sur les rôles (RBAC).
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Fonctionnalité', 'Super Admin', 'Admin', 'Caissier', 'Serveur', 'Client'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Gérer les structures', '✅', '❌', '❌', '❌', '❌'],
                    ['Dashboard & Analytics', '✅', '✅', '❌', '❌', '❌'],
                    ['Gérer le catalogue', '✅', '✅', '❌', '❌', '❌'],
                    ['Prendre une commande', '✅', '✅', '✅', '✅', '✅'],
                    ['Finaliser un paiement', '✅', '✅', '✅', '❌', '❌'],
                    ['Gérer les réservations', '✅', '✅', '✅', '❌', '✅'],
                    ['Gérer les promotions', '✅', '✅', '❌', '❌', '❌'],
                  ].map(([feat, ...vals]) => (
                    <tr key={feat} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{feat}</td>
                      {vals.map((v, i) => <td key={i} className="px-4 py-3 text-center">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── ROLES DETAIL ── */}
          <section id="roles-admin" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Super Admin</h2>
            <p className="text-slate-500 mb-4">Accès complet à tout le système. Peut créer, modifier et supprimer des structures.</p>
            <Callout type="danger">Ce rôle est uniquement attribué par l'équipe Shede. Ne le partagez jamais.</Callout>
          </section>
          <section id="roles-cashier" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Caissier</h2>
            <p className="text-slate-500">Peut prendre des commandes, les finaliser et encaisser. Ne peut pas modifier le catalogue ni les paramètres.</p>
          </section>
          <section id="roles-server" className="mb-20 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Serveur</h2>
            <p className="text-slate-500">Peut uniquement prendre et modifier des commandes actives. Aucun accès aux fonctions financières.</p>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── INTEGRATIONS QR ── */}
          <section id="integrations-qr" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <Globe className="w-3.5 h-3.5" /> Intégrations
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">QR Code & Self-Order</h2>
            <p className="text-slate-500 mb-6">
              Chaque table ou chambre dispose d'un QR code unique généré automatiquement par Shede.
            </p>
            <CodeBlock
              language="URL QR Code générée"
              code={`https://shede.app/menu/{structureSlug}?table={tableId}
https://shede.app/menu/{structureSlug}?room={roomId}`}
            />
            <Callout type="tip">
              Les QR codes sont téléchargeables au format PDF depuis le tableau de bord Admin, prêts à imprimer et à plastifier.
            </Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── INTEGRATIONS PAYMENT ── */}
          <section id="integrations-payment" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Paiements</h2>
            <p className="text-slate-500 mb-6">Shede supporte plusieurs méthodes de paiement adaptées au marché local et international.</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { method: 'Espèces', icon: '💵', desc: 'Paiement manuel enregistré' },
                { method: 'Mobile Money', icon: '📱', desc: 'MTN, Orange Money…' },
                { method: 'Carte bancaire', icon: '💳', desc: 'Visa, Mastercard' },
              ].map((it) => (
                <div key={it.method} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm text-center">
                  <div className="text-3xl mb-2">{it.icon}</div>
                  <p className="font-semibold text-slate-800 text-sm">{it.method}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{it.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── FAQ ── */}
          <section id="faq" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <HelpCircle className="w-3.5 h-3.5" /> FAQ
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Questions fréquentes</h2>
            <div className="space-y-4">
              {[
                { q: 'Shede est-il gratuit pour les clients ?', a: "Oui, totalement. La version B2C (compte client) est 100% gratuite et sans commission sur les commandes." },
                { q: 'Puis-je gérer plusieurs établissements ?', a: "Oui. En tant que Super Admin ou Admin multi-structure, vous pouvez piloter plusieurs restaurants et hôtels depuis un seul compte." },
                { q: 'Les données sont-elles sécurisées ?', a: "Oui. Toutes les données sont chiffrées, hébergées sur des serveurs sécurisés et cloisonnées par structure multi-tenant." },
                { q: "Est-ce qu'il faut installer une application ?", a: "Non. Shede est une Progressive Web App (PWA) accessible depuis n'importe quel navigateur mobile ou desktop." },
                { q: 'Comment obtenir un compte professionnel ?', a: "Contactez-nous via le numéro +237 656 954 474 ou via le formulaire de contact. Un de nos experts vous accompagnera." },
              ].map((item) => (
                <details key={item.q} className="group bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <summary className="flex justify-between items-center px-5 py-4 cursor-pointer font-semibold text-slate-900 text-sm list-none hover:bg-slate-50 transition">
                    {item.q}
                    <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-5 pb-4 pt-2 text-sm text-slate-600 border-t border-slate-100">{item.a}</div>
                </details>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CONTACT SUPPORT ── */}
          <section id="contact-support" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Contacter le support</h2>
            <p className="text-slate-500 mb-6">Notre équipe est disponible 7j/7 pour vous aider.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <a
                href="tel:+237656954474"
                className="flex items-center gap-4 p-5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-purple-500/20"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Appel téléphonique</p>
                  <p className="text-purple-200 text-sm">+237 656 954 474</p>
                </div>
              </a>
              <a
                href="https://portfolio-socrate.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg"
              >
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Portfolio développeur</p>
                  <p className="text-slate-400 text-sm">Etarcos Dev</p>
                </div>
              </a>
            </div>
          </section>

          {/* Footer mini */}
          <div className="text-center py-8 border-t border-slate-100">
            <p className="text-slate-400 text-sm">© 2026 Shede Tech · Documentation v1.0</p>
            <Link href="/" className="text-purple-600 hover:text-purple-800 text-sm font-medium mt-2 inline-block transition">
              ← Retour à l'accueil
            </Link>
          </div>
        </main>

        {/* ── Table of Contents (right) ── */}
        <aside className="hidden xl:block w-56 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Sur cette page</p>
          <nav className="space-y-1.5">
            {navSections.flatMap((s) =>
              s.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`block w-full text-left text-xs py-1 px-2 rounded-lg transition-all ${activeSection === item.id
                      ? 'text-purple-700 font-semibold bg-purple-50'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  {item.label}
                </button>
              ))
            )}
          </nav>
        </aside>
      </div>
    </div>
  );
}
