import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';
import {
  ArrowRight,
  Bed,
  BookOpenCheck,
  CalendarDays,
  Carrot,
  ChefHat,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CookingPot,
  Gauge,
  Languages,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Phone,
  Plug,
  QrCode,
  Receipt,
  Shield,
  ShoppingBasket,
  Store,
  TrendingUp,
  Truck,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { getSession } from '@/lib/auth';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getT } from '@/lib/i18n/server';
import { whatsappLink } from '@/lib/purchasing';
import { MODULE_CATEGORIES, MODULE_OPTIONS, moduleCategoryLabel, moduleDescription } from '@/lib/modules';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap' });

const PHONE = '+237656954474';

type T = Awaited<ReturnType<typeof getT>>['t'];

export default async function HomePage() {
  const session = await getSession();
  const { t } = await getT();

  const navLinks = [
    { href: '#features', label: t('landing.nav.features') },
    { href: '#anticipate', label: t('landing.nav.anticipate') },
    { href: '#modules', label: t('landing.nav.modules') },
    { href: '#solutions', label: t('landing.nav.solutions') },
    { href: '#contact', label: t('landing.nav.contact') },
  ];

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-50 text-slate-900 antialiased`}>
      {/* Navigation */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            <img src="/logo.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-lg ring-2 ring-violet-600" />
            <span className="text-xl font-extrabold tracking-tight">Shede</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher tone="light" />
            {session ? (
              <Link href={session.role === 'CLIENT' ? '/client' : '/dashboard'} className="inline-flex h-10 items-center rounded-full bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-violet-700">
                {t('landing.nav.mySpace')}
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden h-10 items-center rounded-full px-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:text-slate-900 sm:inline-flex">
                  {t('landing.nav.login')}
                </Link>
                <Link href="/register-business" className="hidden h-10 items-center rounded-full bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm shadow-violet-600/20 transition-colors duration-200 hover:bg-violet-700 sm:inline-flex">
                  {t('landing.nav.start')}
                </Link>
              </>
            )}
            {/* Menu mobile sans JavaScript */}
            <details className="group relative lg:hidden">
              <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 [&::-webkit-details-marker]:hidden" aria-label={t('landing.nav.menu')}>
                <Menu className="h-5 w-5" aria-hidden />
              </summary>
              <div className="absolute right-0 top-12 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    {link.label}
                  </a>
                ))}
                {!session && (
                  <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2">
                    <Link href="/login" className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                      {t('landing.nav.login')}
                    </Link>
                    <Link href="/register-business" className="rounded-lg bg-violet-600 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-violet-700">
                      {t('landing.nav.start')}
                    </Link>
                  </div>
                )}
              </div>
            </details>
          </div>
        </nav>
      </header>

      <Hero t={t} />
      <Pillars t={t} />
      <Anticipate t={t} />
      <Local t={t} />
      <Modules t={t} />
      <Solutions t={t} />
      <FinalCta t={t} />
      <Footer t={t} />
    </main>
  );
}

function SectionHeading({ eyebrow, title, text, dark = false }: { eyebrow?: string; title: React.ReactNode; text?: string; dark?: boolean }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
      {eyebrow && <p className={`mb-3 text-sm font-bold uppercase tracking-wider ${dark ? 'text-orange-300' : 'text-orange-700'}`}>{eyebrow}</p>}
      <h2 className={`text-balance text-3xl font-extrabold tracking-tight md:text-5xl ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
      {text && <p className={`mt-4 text-pretty text-lg leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{text}</p>}
    </div>
  );
}

/* ───────────────────────────── Hero ───────────────────────────── */

function Hero({ t }: { t: T }) {
  const chips = [
    { icon: BookOpenCheck, label: t('landing.hero.chipSyscohada') },
    { icon: Receipt, label: t('landing.hero.chipCurrency') },
    { icon: Gauge, label: t('landing.hero.chipMultisite') },
    { icon: Languages, label: t('landing.hero.chipLanguages') },
  ];

  return (
    <section className="relative overflow-hidden pb-20 pt-28 md:pb-28 md:pt-36">
      {/* Fond : halo violet et grille discrète */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-violet-300/40 blur-[120px]" />
        <div className="absolute bottom-0 left-[-10%] h-[420px] w-[420px] rounded-full bg-orange-200/40 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)' }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div>
          <h1 className="landing-rise text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl [animation-delay:80ms]">
            <span className="block">{t('landing.hero.titleBefore')}</span>
            <span className="block bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">{t('landing.hero.titleMiddle')}</span>
            <span className="block">{t('landing.hero.titleAfter')}</span>
          </h1>
          <p className="landing-rise mt-6 max-w-xl text-pretty text-lg leading-relaxed text-slate-600 [animation-delay:160ms]">{t('landing.hero.text')}</p>

          <div className="landing-rise mt-8 flex flex-col gap-3 sm:flex-row [animation-delay:240ms]">
            <Link
              href="/register-business"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 font-semibold text-white shadow-lg shadow-violet-600/25 transition-colors duration-200 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            >
              {t('landing.hero.cta')}
              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <a
              href={`tel:${PHONE}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 font-semibold text-slate-800 transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            >
              <Phone className="h-4 w-4" aria-hidden /> {t('landing.hero.ctaSecondary')}
            </a>
          </div>

          <ul className="landing-rise mt-10 flex flex-wrap gap-2 [animation-delay:320ms]">
            {chips.map((chip) => (
              <li key={chip.label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                <chip.icon className="h-4 w-4 text-violet-600" aria-hidden /> {chip.label}
              </li>
            ))}
          </ul>
        </div>

        <HeroMockup t={t} />
      </div>
    </section>
  );
}

/** Aperçu d'écran construit en code (illustratif, données d'exemple). */
function HeroMockup({ t }: { t: T }) {
  const days = [
    { key: 'd1', forecast: 42, actual: 40 },
    { key: 'd2', forecast: 38, actual: 39 },
    { key: 'd3', forecast: 45, actual: 43 },
    { key: 'd4', forecast: 51, actual: null },
    { key: 'd5', forecast: 66, actual: null },
    { key: 'd6', forecast: 78, actual: null },
    { key: 'd7', forecast: 30, actual: null },
  ] as const;
  const max = 80;

  return (
    <div aria-hidden className="landing-rise relative mx-auto w-full max-w-xl [animation-delay:200ms] lg:max-w-none sm:mb-20">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-orange-400/20 blur-2xl" />

      {/* Fenêtre principale */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ml-3 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">shede.app/forecasts</span>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('landing.mock.forecastPoint')}</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{t('landing.mock.forecastTitle')}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right ring-1 ring-emerald-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{t('landing.mock.accuracy')}</p>
              <p className="text-xl font-extrabold tabular-nums text-emerald-700">{t('landing.mock.accuracyValue')}</p>
            </div>
          </div>

          <div className="mt-6 flex h-44 items-end gap-2 sm:gap-3">
            {days.map((day) => (
              <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="relative flex h-full w-full items-end justify-center gap-1">
                  <div className="w-1/2 max-w-4 rounded-t-md bg-violet-200" style={{ height: `${(day.forecast / max) * 100}%` }} />
                  {day.actual !== null && <div className="w-1/2 max-w-4 rounded-t-md bg-violet-600" style={{ height: `${(day.actual / max) * 100}%` }} />}
                </div>
                <span className="text-[11px] font-medium text-slate-500">{t(`landing.mock.days.${day.key}`)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-200" /> {t('landing.mock.forecast')}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-600" /> {t('landing.mock.actual')}</span>
            </div>
            <span className="italic">{t('landing.mock.sample')}</span>
          </div>
        </div>
      </div>

      {/* Carte flottante : coût matière */}
      <div className="landing-float absolute -bottom-24 -left-3 hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:block lg:-left-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <Carrot className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">{t('landing.mock.foodCost')}</p>
            <p className="text-lg font-extrabold tabular-nums text-slate-900">{t('landing.mock.foodCostValue')}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-36 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[78%] rounded-full bg-orange-500" />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">{t('landing.mock.foodCostTarget')}</p>
      </div>

      {/* Notification : bon de commande envoyé */}
      <div className="landing-float absolute -bottom-6 right-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 pr-5 shadow-xl backdrop-blur [animation-delay:1.5s] sm:-right-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900">{t('landing.mock.orderSent')}</p>
          <p className="text-xs text-slate-500">{t('landing.mock.orderSentVia')}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Trois piliers ───────────────────────────── */

function Pillars({ t }: { t: T }) {
  const pillars: { icon: LucideIcon; title: string; text: string; tone: string; items: { icon: LucideIcon; title: string; text: string }[] }[] = [
    {
      icon: Store,
      title: t('landing.pillars.sellTitle'),
      text: t('landing.pillars.sellText'),
      tone: 'bg-violet-600',
      items: [
        { icon: UtensilsCrossed, title: t('landing.features.posTitle'), text: t('landing.features.posText') },
        { icon: ChefHat, title: t('landing.features.kitchenTitle'), text: t('landing.features.kitchenText') },
        { icon: QrCode, title: t('landing.features.qrTitle'), text: t('landing.features.qrText') },
        { icon: Bed, title: t('landing.features.pmsTitle'), text: t('landing.features.pmsText') },
      ],
    },
    {
      icon: TrendingUp,
      title: t('landing.pillars.anticipateTitle'),
      text: t('landing.pillars.anticipateText'),
      tone: 'bg-orange-600',
      items: [
        { icon: TrendingUp, title: t('landing.features.forecastTitle'), text: t('landing.features.forecastText') },
        { icon: CookingPot, title: t('landing.features.productionTitle'), text: t('landing.features.productionText') },
        { icon: Truck, title: t('landing.features.purchasingTitle'), text: t('landing.features.purchasingText') },
        { icon: Carrot, title: t('landing.features.stockTitle'), text: t('landing.features.stockText') },
      ],
    },
    {
      icon: LayoutDashboard,
      title: t('landing.pillars.steerTitle'),
      text: t('landing.pillars.steerText'),
      tone: 'bg-slate-900',
      items: [
        { icon: BookOpenCheck, title: t('landing.features.accountingTitle'), text: t('landing.features.accountingText') },
        { icon: Gauge, title: t('landing.features.multisiteTitle'), text: t('landing.features.multisiteText') },
        { icon: Plug, title: t('landing.features.apiTitle'), text: t('landing.features.apiText') },
        { icon: Shield, title: t('landing.features.securityTitle'), text: t('landing.features.securityText') },
      ],
    },
  ];

  return (
    <section id="features" className="scroll-mt-20 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={t('landing.pillars.eyebrow')} title={t('landing.pillars.title')} text={t('landing.pillars.text')} />

        <div className="grid gap-6 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="flex flex-col rounded-3xl border border-slate-200 bg-slate-50/70 p-6 transition-shadow duration-200 hover:shadow-lg sm:p-8">
              <div className="flex items-center gap-4">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${pillar.tone}`}>
                  <pillar.icon className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <h3 className="text-2xl font-extrabold tracking-tight">{pillar.title}</h3>
                  <p className="text-sm text-slate-600">{pillar.text}</p>
                </div>
              </div>
              <ul className="mt-6 space-y-1">
                {pillar.items.map((item) => (
                  <li key={item.title} className="flex gap-3 rounded-2xl p-3 transition-colors duration-200 hover:bg-white">
                    <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" aria-hidden />
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Anticiper ───────────────────────────── */

function Anticipate({ t }: { t: T }) {
  const steps = [
    { icon: TrendingUp, title: t('landing.anticipate.step1Title'), text: t('landing.anticipate.step1Text') },
    { icon: ShoppingBasket, title: t('landing.anticipate.step2Title'), text: t('landing.anticipate.step2Text') },
    { icon: CookingPot, title: t('landing.anticipate.step3Title'), text: t('landing.anticipate.step3Text') },
    { icon: ClipboardCheck, title: t('landing.anticipate.step4Title'), text: t('landing.anticipate.step4Text') },
  ];
  const lines = [
    { name: t('landing.mock.item1'), qty: t('landing.mock.item1Qty') },
    { name: t('landing.mock.item2'), qty: t('landing.mock.item2Qty') },
    { name: t('landing.mock.item3'), qty: t('landing.mock.item3Qty') },
  ];

  return (
    <section id="anticipate" className="relative scroll-mt-20 overflow-hidden bg-slate-950 py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            {t('landing.anticipate.titleBefore')} <span className="text-orange-300">{t('landing.anticipate.highlight')}</span>
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-slate-300">{t('landing.anticipate.text')}</p>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Étapes en frise verticale */}
          <ol className="relative space-y-8 before:absolute before:bottom-6 before:left-6 before:top-6 before:w-px before:bg-gradient-to-b before:from-violet-500 before:to-orange-400">
            {steps.map((step, idx) => (
              <li key={step.title} className="relative flex gap-5">
                <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-violet-300 ring-1 ring-white/15">
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{String(idx + 1).padStart(2, '0')}</p>
                  <h3 className="text-xl font-bold text-white">{step.title}</h3>
                  <p className="mt-1 leading-relaxed text-slate-300">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Aperçu : commande suggérée */}
          <div aria-hidden className="rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur">
            <div className="rounded-2xl bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-slate-900">{t('landing.mock.suggestedTitle')}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                    <CalendarDays className="h-4 w-4" /> {t('landing.mock.suggestedSupplier')}
                  </p>
                </div>
                <span className="text-xs italic text-slate-400">{t('landing.mock.sample')}</span>
              </div>
              <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {lines.map((line) => (
                  <li key={line.name} className="flex items-center justify-between px-4 py-3">
                    <span className="flex items-center gap-3 font-medium text-slate-800">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-600 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {line.name}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">{line.qty}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 font-semibold text-white">
                <ShoppingBasket className="h-4 w-4" /> {t('landing.mock.createOrder')}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center gap-6 text-center">
          <p className="flex max-w-2xl items-start gap-2 text-left text-slate-200 sm:items-center">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400 sm:mt-0" aria-hidden /> {t('landing.anticipate.proof')}
          </p>
          <a
            href={whatsappLink(PHONE, t('landing.cta.demoMessage'))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-orange-500 px-6 font-semibold text-slate-950 transition-colors duration-200 hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
          >
            {t('landing.anticipate.cta')} <ArrowRight className="h-5 w-5" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Pensé pour le Cameroun ───────────────────────────── */

function Local({ t }: { t: T }) {
  const tiles = [
    { icon: BookOpenCheck, title: t('landing.local.syscohadaTitle'), text: t('landing.local.syscohadaText'), wide: true },
    { icon: Receipt, title: t('landing.local.currencyTitle'), text: t('landing.local.currencyText') },
    { icon: MessageCircle, title: t('landing.local.whatsappTitle'), text: t('landing.local.whatsappText') },
    { icon: CalendarDays, title: t('landing.local.holidaysTitle'), text: t('landing.local.holidaysText') },
    { icon: Languages, title: t('landing.local.languagesTitle'), text: t('landing.local.languagesText') },
    { icon: Gauge, title: t('landing.local.multisiteTitle'), text: t('landing.local.multisiteText'), wide: true },
  ];

  return (
    <section className="bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={t('landing.local.eyebrow')} title={t('landing.local.title')} text={t('landing.local.text')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.title}
              className={`rounded-3xl border border-slate-200 bg-white p-6 transition-shadow duration-200 hover:shadow-lg ${tile.wide ? 'lg:col-span-2' : ''}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                <tile.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{tile.title}</h3>
              <p className="mt-1.5 leading-relaxed text-slate-600">{tile.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Modules à la carte ───────────────────────────── */

const CATEGORY_TONES: Record<(typeof MODULE_CATEGORIES)[number], string> = {
  Core: 'bg-violet-100 text-violet-800',
  Restauration: 'bg-orange-100 text-orange-800',
  Gestion: 'bg-slate-200 text-slate-800',
};

function Modules({ t }: { t: T }) {
  return (
    <section id="modules" className="scroll-mt-20 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          title={
            <>
              {t('landing.modulesSection.titleBefore')} <span className="text-violet-600">{t('landing.modulesSection.highlight')}</span>
            </>
          }
          text={t('landing.modulesSection.text')}
        />
        {/* Une seule grille : 15 modules = 5 lignes pleines de 3, sans colonne plus courte que les autres. */}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_CATEGORIES.flatMap((category) =>
            MODULE_OPTIONS.filter((m) => m.category === category).map((m) => (
              <li key={m.value} className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition-shadow duration-200 hover:shadow-md">
                <span className={`mb-3 inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_TONES[category]}`}>
                  {/* sans l'emoji de tête, réservé au back-office */ moduleCategoryLabel(t, category).replace(/^[^\p{L}]+/u, '')}
                </span>
                <p className="font-bold text-slate-900">{t(`modules.names.${m.value}`)}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{moduleDescription(t, m.value)}</p>
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}

/* ───────────────────────────── Solutions ───────────────────────────── */

function Solutions({ t }: { t: T }) {
  return (
    <section id="solutions" className="scroll-mt-20 bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          title={
            <>
              {t('landing.solutions.titleBefore')} <span className="text-violet-600">{t('landing.solutions.clients')}</span> {t('landing.solutions.and')}{' '}
              <span className="text-violet-600">{t('landing.solutions.professionals')}</span>
            </>
          }
          text={t('landing.solutions.text')}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <Users className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-5 text-2xl font-extrabold tracking-tight">{t('landing.solutions.clientTitle')}</h3>
            <p className="mt-2 text-slate-600">{t('landing.solutions.clientText')}</p>
            <ul className="mb-8 mt-6 space-y-3">
              {(['client1', 'client2', 'client3', 'client4'] as const).map((key) => (
                <li key={key} className="flex items-center gap-3 text-slate-700">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-600" aria-hidden /> {t(`landing.solutions.${key}`)}
                </li>
              ))}
            </ul>
            <Link
              href="/register-client"
              className="group mt-auto inline-flex h-12 items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-5 font-semibold text-violet-800 transition-colors duration-200 hover:bg-violet-100"
            >
              {t('landing.solutions.clientCta')}
              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </article>

          <article className="flex flex-col rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <LayoutDashboard className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-5 text-2xl font-extrabold tracking-tight">{t('landing.solutions.proTitle')}</h3>
            <p className="mt-2 text-slate-300">{t('landing.solutions.proText')}</p>
            <ul className="mb-8 mt-6 space-y-3">
              {(['pro1', 'pro2', 'pro3', 'pro4'] as const).map((key) => (
                <li key={key} className="flex items-center gap-3 text-slate-200">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-orange-300" aria-hidden /> {t(`landing.solutions.${key}`)}
                </li>
              ))}
            </ul>
            <Link
              href="/register-business"
              className="group mt-auto inline-flex h-12 items-center justify-between rounded-xl bg-violet-600 px-5 font-semibold text-white transition-colors duration-200 hover:bg-violet-500"
            >
              {t('landing.solutions.proCta')}
              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Appel final ───────────────────────────── */

function FinalCta({ t }: { t: T }) {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 md:py-28">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 px-6 py-14 text-center shadow-2xl shadow-violet-600/25 sm:px-12 md:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white md:text-5xl">{t('landing.cta.title')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-violet-100">{t('landing.cta.text')}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register-business"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-violet-700 transition-colors duration-200 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Store className="h-5 w-5" aria-hidden /> {t('landing.cta.start')}
            </Link>
            <a
              href={whatsappLink(PHONE, t('landing.cta.demoMessage'))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/40 px-6 font-semibold text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <MessageCircle className="h-5 w-5" aria-hidden /> {t('landing.cta.demo')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Pied de page ───────────────────────────── */

function Footer({ t }: { t: T }) {
  const linkClass = 'transition-colors duration-200 hover:text-white';
  return (
    <footer id="contact" className="scroll-mt-20 bg-slate-950 py-14 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <img src="/logo.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-lg ring-2 ring-violet-500" />
              <span className="text-xl font-extrabold text-white">Shede</span>
            </div>
            <p className="text-sm leading-relaxed">{t('landing.footer.tagline')}</p>
          </div>
          <div>
            <h3 className="mb-4 font-semibold text-white">{t('landing.footer.product')}</h3>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#features" className={linkClass}>{t('landing.footer.features')}</a></li>
              <li><a href="#solutions" className={linkClass}>{t('landing.footer.solutions')}</a></li>
              <li><a href={`tel:${PHONE}`} className={linkClass}>{t('landing.footer.pricing')}</a></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-semibold text-white">{t('landing.footer.resources')}</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/docs" className={linkClass}>{t('landing.footer.docs')}</Link></li>
              <li><Link href="/docs/api" className={linkClass}>{t('landing.footer.api')}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-semibold text-white">{t('landing.footer.contact')}</h3>
            <ul className="space-y-2.5 text-sm">
              <li><a href={`tel:${PHONE}`} className={linkClass}>+237 656 954 474</a></li>
              <li>
                <a href={whatsappLink(PHONE, t('landing.cta.demoMessage'))} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-800 pt-8 text-sm sm:flex-row">
          <p>{t('landing.footer.rights', { year: new Date().getFullYear() })}</p>
          <p>
            {t('landing.footer.designBy')}{' '}
            <a href="https://portfolio-socrate.vercel.app/" className="text-violet-300 transition-colors duration-200 hover:text-violet-200">
              Etarcos Dev
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
