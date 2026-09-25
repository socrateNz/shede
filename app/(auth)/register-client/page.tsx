'use client';

import { registerClient } from '@/app/actions/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Mail,
  Lock,
  User,
  CheckCircle2,
  UtensilsCrossed,
  Gift,
  QrCode,
} from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { LanguageSwitcher } from '@/components/language-switcher';

const CLIENT_BENEFITS = ['booking', 'loyalty', 'scan', 'offers'] as const;

export default function RegisterClientPage() {
  const router = useRouter();
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(registerClient, {
    success: false,
    error: '',
  });

  useEffect(() => {
    if (state.success) {
      router.push('/client');
    }
  }, [state.success, router]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Panneau branding */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-purple-700 via-purple-600 to-violet-800 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute right-1/4 top-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>

        <div className="relative z-10 p-10 xl:p-14">
          <Link
            href="/"
            className="group mb-12 inline-flex items-center gap-2 text-sm text-purple-100/90 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {t('common.backToHome')}
          </Link>

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
              <img src="/logo.webp" alt="Shede" className="h-8 w-8 rounded-lg" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Shede</p>
              <p className="text-sm text-purple-100/80">{t('auth.registerClient.clientSpace')}</p>
            </div>
          </div>

          <h1 className="max-w-md text-3xl font-bold leading-tight text-white xl:text-4xl">
            {t('auth.registerClient.heroTitle')}{' '}
            <span className="text-purple-200">{t('auth.registerClient.heroHighlight')}</span>
          </h1>
          <p className="mt-4 max-w-sm text-base text-purple-100/90">
            {t('auth.registerClient.heroText')}
          </p>

          <ul className="mt-10 space-y-4">
            {CLIENT_BENEFITS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-sm text-purple-50/95 sm:text-base">{t(`auth.registerClient.benefits.${item}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 hidden gap-4 p-10 xl:flex xl:p-14">
          {[
            { icon: UtensilsCrossed, label: t('auth.registerClient.featureMenus') },
            { icon: QrCode, label: t('auth.registerClient.featureScan') },
            { icon: Gift, label: t('auth.registerClient.featureLoyalty') },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-5 backdrop-blur-sm"
            >
              <Icon className="h-6 w-6 text-purple-100" />
              <span className="text-center text-xs font-medium text-purple-50">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panneau formulaire */}
      <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-slate-50 via-white to-purple-50/40 px-4 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-purple-700 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.home')}
          </Link>

          <div className="mb-8 lg:mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700">
              {t('auth.registerClient.badge')}
            </div>
            <LanguageSwitcher tone="light" className="ml-2 align-middle" />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('auth.registerClient.title')}
            </h2>
            <p className="mt-2 text-slate-600">
              {t('auth.registerClient.subtitle')}
            </p>
          </div>

          {/* Avantages mobile */}
          <div className="mb-8 grid grid-cols-3 gap-2 lg:hidden">
            {[
              { icon: UtensilsCrossed, label: t('auth.registerClient.shortMenus') },
              { icon: QrCode, label: t('auth.registerClient.shortScan') },
              { icon: Gift, label: t('auth.registerClient.shortOffers') },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-purple-100 bg-white px-2 py-3 text-center shadow-sm"
              >
                <Icon className="h-5 w-5 text-purple-600" />
                <span className="text-xs font-medium text-slate-700">{label}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-purple-500/5 sm:p-8">
            <form action={formAction} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="firstName"
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-700"
                  >
                    <User className="h-3.5 w-3.5 text-purple-500" />
                    {t('common.firstName')}
                  </label>
                  <Input
                    id="firstName"
                    type="text"
                    name="firstName"
                    placeholder={t('auth.registerClient.firstNamePlaceholder')}
                    autoComplete="given-name"
                    className="h-11 border-slate-200 bg-slate-50/80 transition-colors focus:border-purple-400 focus:ring-purple-400/20"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-sm font-medium text-slate-700">
                    {t('common.lastName')}
                  </label>
                  <Input
                    id="lastName"
                    type="text"
                    name="lastName"
                    placeholder={t('auth.registerClient.lastNamePlaceholder')}
                    autoComplete="family-name"
                    className="h-11 border-slate-200 bg-slate-50/80 transition-colors focus:border-purple-400 focus:ring-purple-400/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-700"
                >
                  <Mail className="h-3.5 w-3.5 text-purple-500" />
                  {t('common.email')}
                </label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  placeholder={t('auth.registerClient.emailPlaceholder')}
                  autoComplete="email"
                  className="h-11 border-slate-200 bg-slate-50/80 transition-colors focus:border-purple-400 focus:ring-purple-400/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-700"
                >
                  <Lock className="h-3.5 w-3.5 text-purple-500" />
                  {t('common.password')}
                </label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="h-11 border-slate-200 bg-slate-50/80 transition-colors focus:border-purple-400 focus:ring-purple-400/20"
                  required
                  minLength={6}
                />
                <p className="text-xs text-slate-500">{t('auth.registerClient.passwordHint')}</p>
              </div>

              {state.error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  {state.error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="h-12 w-full cursor-pointer rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-base font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:from-purple-700 hover:to-violet-700 hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-60"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('auth.registerClient.submitting')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    {t('auth.registerClient.submit')}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-6 text-center text-sm">
              <p className="text-slate-600">
                {t('auth.registerClient.hasAccount')}{' '}
                <Link
                  href="/login"
                  className="font-semibold text-purple-600 transition-colors hover:text-purple-800"
                >
                  {t('auth.registerClient.login')}
                </Link>
              </p>
              <p className="text-slate-500">
                {t('auth.registerClient.isBusiness')}{' '}
                <Link
                  href="/register-business"
                  className="font-semibold text-slate-700 transition-colors hover:text-purple-700"
                >
                  {t('auth.registerClient.businessAccount')}
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            {t('auth.registerClient.terms')}
          </p>
        </div>
      </div>
    </div>
  );
}
