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
import { useT } from '@/lib/i18n/client';
import { DOCS_CONTENT, type DocsContent } from './content';

/* ─────────────────────────────────────────
   DATA
───────────────────────────────────────── */

const NAV_SECTIONS: { key: keyof DocsContent['nav']; icon: typeof Zap }[] = [
  { key: 'start', icon: Zap },
  { key: 'client', icon: Users },
  { key: 'pro', icon: LayoutDashboard },
  { key: 'roles', icon: Shield },
  { key: 'integrations', icon: Globe },
  { key: 'support', icon: HelpCircle },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'text-purple-400',
  ORG_ADMIN: 'text-emerald-400',
  ADMIN: 'text-blue-400',
  CAISSE: 'text-yellow-400',
  SERVEUR: 'text-cyan-400',
  CLIENT: 'text-pink-400',
};

/* ─────────────────────────────────────────
   CODE BLOCK COMPONENT
───────────────────────────────────────── */
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const { locale } = useT();
  const labels = DOCS_CONTENT[locale].header;
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
          {copied ? labels.copied : labels.copy}
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
  const { locale } = useT();
  const c = DOCS_CONTENT[locale];
  const navSections = NAV_SECTIONS.map(({ key, icon }) => ({
    key,
    icon,
    title: c.nav[key].title,
    items: Object.entries(c.nav[key].items).map(([id, label]) => ({ id, label })),
  }));
  const [activeSection, setActiveSection] = useState('introduction');
  const [openSections, setOpenSections] = useState<string[]>(['start', 'client', 'pro']);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (key: string) => {
    setOpenSections(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
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
              aria-label={c.header.menu}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2 group">
              <img src="/logo.webp" alt="Shede" className="w-7 h-7 border-2 border-purple-600 rounded-lg" />
              <span className="font-bold text-slate-900 text-lg">Shede</span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1 text-sm text-slate-400">
              <ChevronRight className="w-4 h-4" /> {c.header.docs}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-sm bg-slate-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder={c.header.search}
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
              <ArrowLeft className="w-4 h-4" /> {c.header.back}
            </Link>
            <Link
              href="/docs/api"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 transition"
            >
              API
            </Link>
            <Link
              href="/register-client"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-md transition hover:-translate-y-0.5"
            >
              {c.header.start}
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">{c.header.navigation}</p>
            {navSections.map((section) => {
              const isOpen = openSections.includes(section.key);
              return (
                <div key={section.key} className="mb-2">
                  <button
                    onClick={() => toggleSection(section.key)}
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
              <HelpCircle className="w-4 h-4" /> {c.header.help}
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
              <BookOpen className="w-3.5 h-3.5" /> {c.intro.badge}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
              {c.intro.titleBefore} <span className="text-purple-600">Shede</span>
            </h1>
            <p className="text-lg text-slate-500 mb-6 leading-relaxed">{c.intro.text}</p>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: UtensilsCrossed, color: 'text-orange-500 bg-orange-50' },
                { icon: Bed, color: 'text-purple-500 bg-purple-50' },
                { icon: Users, color: 'text-blue-500 bg-blue-50' },
              ].map((card, i) => (
                <div key={i} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{c.intro.cards[i].title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.intro.cards[i].desc}</p>
                </div>
              ))}
            </div>

            <Callout type="info">{c.intro.callout}</Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── QUICKSTART ── */}
          <section id="quickstart" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Zap className="w-7 h-7 text-yellow-500" /> {c.quickstart.title}
            </h2>
            <p className="text-slate-500 mb-6">{c.quickstart.text}</p>

            <div className="space-y-4">
              {c.quickstart.steps.map((item, i) => (
                <div key={i} className="flex gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
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
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.architecture.title}</h2>
            <p className="text-slate-500 mb-6">{c.architecture.text}</p>

            <div className="bg-slate-900 text-slate-300 rounded-2xl p-6 font-mono text-sm leading-loose border border-slate-700 mb-6">
              <div className="text-green-400 font-bold mb-2">{c.architecture.codeTitle}</div>
              {c.architecture.roles.map((role) => (
                <div key={role.code} style={{ marginLeft: `${role.indent}rem` }}>
                  <span className={ROLE_COLORS[role.code] ?? 'text-slate-200'}>{role.code}</span>  →  {role.desc}
                </div>
              ))}
            </div>

            <Callout type="tip">{c.architecture.callout}</Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CLIENT ACCOUNT ── */}
          <section id="client-account" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <Users className="w-3.5 h-3.5" /> {c.clientAccount.badge}
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.clientAccount.title}</h2>
            <p className="text-slate-500 mb-6">{c.clientAccount.text}</p>
            <ul className="space-y-2 mb-6">
              {c.clientAccount.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> {it}
                </li>
              ))}
            </ul>
            <CodeBlock language="URL" code={c.clientAccount.code} />
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CLIENT RESERVATIONS ── */}
          <section id="client-reservations" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.reservations.title}</h2>
            <p className="text-slate-500 mb-6">{c.reservations.text}</p>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {[CalendarCheck, CreditCard, Smartphone, FileText].map((Icon, i) => (
                <div key={i} className="flex gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <Icon className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{c.reservations.items[i].title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.reservations.items[i].desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="warning">{c.reservations.callout}</Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CLIENT ORDERS & QR ── */}
          <section id="client-orders" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.orders.title}</h2>
            <p className="text-slate-500 mb-6">{c.orders.text}</p>
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-center gap-3 mb-4">
                <QrCode className="w-8 h-8" />
                <div>
                  <p className="font-bold text-lg">{c.orders.cardTitle}</p>
                  <p className="text-purple-200 text-sm">{c.orders.cardText}</p>
                </div>
              </div>
              <ol className="space-y-2 text-sm text-purple-100">
                {c.orders.steps.map((step, i) => (
                  <li key={i} className="flex gap-2"><span className="font-bold text-white">{i + 1}.</span> {step}</li>
                ))}
              </ol>
            </div>
            <CodeBlock language={c.orders.workflowLabel} code={c.orders.workflow} />
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── CLIENT FIDELITE ── */}
          <section id="client-fidelite" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.loyalty.title}</h2>
            <p className="text-slate-500 mb-6">{c.loyalty.text}</p>
            <div className="space-y-3">
              {[Star, Tag, CreditCard].map((Icon, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition">
                  <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4.5 h-4.5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{c.loyalty.items[i].label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.loyalty.items[i].desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO DASHBOARD ── */}
          <section id="pro-dashboard" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-200 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <LayoutDashboard className="w-3.5 h-3.5" /> {c.dashboard.badge}
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.dashboard.title}</h2>
            <p className="text-slate-500 mb-6">{c.dashboard.text}</p>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {c.dashboard.items.map((it) => (
                <div key={it} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-700">
                  <BarChart3 className="w-4 h-4 text-purple-500 flex-shrink-0" /> {it}
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO POS ── */}
          <section id="pro-pos" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.pos.title}</h2>
            <p className="text-slate-500 mb-6">{c.pos.text}</p>
            <CodeBlock language={c.pos.workflowLabel} code={c.pos.workflow} />
            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              {[UtensilsCrossed, Package, Tag].map((Icon, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-100 rounded-xl text-sm font-medium text-orange-700">
                  <Icon className="w-4 h-4" /> {c.pos.tags[i]}
                </div>
              ))}
            </div>
            <Callout type="info">{c.pos.callout}</Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO PMS ── */}
          <section id="pro-pms" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.pms.title}</h2>
            <p className="text-slate-500 mb-6">{c.pms.text}</p>
            <div className="space-y-3 mb-6">
              {['bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500'].map((color, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                  <div className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{c.pms.statuses[i].status}</p>
                    <p className="text-xs text-slate-500">{c.pms.statuses[i].desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO STOCKS ── */}
          <section id="pro-stocks" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.stocks.title}</h2>
            <p className="text-slate-500 mb-6">{c.stocks.text}</p>
            <CodeBlock language={c.stocks.codeLabel} code={c.stocks.code} />
            <Callout type="warning">{c.stocks.callout}</Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── PRO PROMOS ── */}
          <section id="pro-promos" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.promos.title}</h2>
            <p className="text-slate-500 mb-6">{c.promos.text}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {c.promos.items.map((it) => (
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
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.analytics.title}</h2>
            <p className="text-slate-500 mb-6">{c.analytics.text}</p>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {c.analytics.stats.map((stat) => (
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
              <Shield className="w-3.5 h-3.5" /> {c.roles.badge}
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.roles.title}</h2>
            <p className="text-slate-500 mb-6">{c.roles.text}</p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {c.roles.headers.map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {c.roles.rows.map(([feat, ...vals]) => (
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
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{c.roles.superAdmin.title}</h2>
            <p className="text-slate-500 mb-4">{c.roles.superAdmin.text}</p>
            <Callout type="danger">{c.roles.superAdmin.callout}</Callout>
          </section>
          <section id="roles-cashier" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{c.roles.cashier.title}</h2>
            <p className="text-slate-500">{c.roles.cashier.text}</p>
          </section>
          <section id="roles-server" className="mb-20 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{c.roles.server.title}</h2>
            <p className="text-slate-500">{c.roles.server.text}</p>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── INTEGRATIONS QR ── */}
          <section id="integrations-qr" className="mb-20 scroll-mt-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <Globe className="w-3.5 h-3.5" /> {c.qr.badge}
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.qr.title}</h2>
            <p className="text-slate-500 mb-6">{c.qr.text}</p>
            <CodeBlock language={c.qr.codeLabel} code={c.qr.code} />
            <Callout type="tip">{c.qr.callout}</Callout>
          </section>

          <hr className="border-slate-100 mb-20" />

          {/* ── INTEGRATIONS PAYMENT ── */}
          <section id="integrations-payment" className="mb-20 scroll-mt-24">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.payments.title}</h2>
            <p className="text-slate-500 mb-6">{c.payments.text}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {['💵', '📱', '💳'].map((icon, i) => (
                <div key={i} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm text-center">
                  <div className="text-3xl mb-2">{icon}</div>
                  <p className="font-semibold text-slate-800 text-sm">{c.payments.methods[i].method}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.payments.methods[i].desc}</p>
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
            <h2 className="text-3xl font-bold text-slate-900 mb-6">{c.faq.title}</h2>
            <div className="space-y-4">
              {c.faq.items.map((item) => (
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
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{c.contact.title}</h2>
            <p className="text-slate-500 mb-6">{c.contact.text}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <a
                href="tel:+237656954474"
                className="flex items-center gap-4 p-5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-purple-500/20"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">{c.contact.call}</p>
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
                  <p className="font-bold">{c.contact.portfolio}</p>
                  <p className="text-slate-400 text-sm">Etarcos Dev</p>
                </div>
              </a>
            </div>
          </section>

          {/* Footer mini */}
          <div className="text-center py-8 border-t border-slate-100">
            <p className="text-slate-400 text-sm">{c.footer.version.replace('{year}', String(new Date().getFullYear()))}</p>
            <Link href="/" className="text-purple-600 hover:text-purple-800 text-sm font-medium mt-2 inline-block transition">
              {c.footer.backHome}
            </Link>
          </div>
        </main>

        {/* ── Table of Contents (right) ── */}
        <aside className="hidden xl:block w-56 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{c.header.onThisPage}</p>
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
