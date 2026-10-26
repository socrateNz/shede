'use client';

import { login } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { InstallAppButton } from '@/components/install-app-button';
import { useActionState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { LanguageSwitcher } from '@/components/language-switcher';
import { TavolaLogo } from '@/components/brand/tavola-logo';

function LoginForm() {
  const router = useRouter();
  const { t } = useT();
  const searchParams = useSearchParams();
  const [state, formAction, isPending] = useActionState(login, {
    success: false,
    error: '',
  });

  const licenseExpired = searchParams.get('error') === 'license_expired';
  const pointInactive = searchParams.get('error') === 'point_inactive';
  const passwordReset = searchParams.get('reset') === '1';
  const redirectAfterLogin = searchParams.get('redirect');

  useEffect(() => {
    if (state.success && state.redirect) {
      const target =
        redirectAfterLogin?.startsWith('/') && !redirectAfterLogin.startsWith('//')
          ? redirectAfterLogin
          : state.redirect;
      router.push(target);
    }
  }, [state.success, state.redirect, redirectAfterLogin, router]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] bg-slate-950">
      {/* Panneau de marque (grand écran) : logo complet, signature et slogan */}
      <aside className="relative hidden overflow-hidden border-r border-slate-800 px-12 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <TavolaLogo variant="full" tone="dark" size={92} />
        <p className="mt-10 font-brand text-2xl italic text-slate-200">{t('auth.login.slogan')}</p>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.32em] text-blue-500">{t('auth.login.sectors')}</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <TavolaLogo variant="full" tone="dark" size={56} />
            <p className="mt-5 font-brand text-lg italic text-slate-300">{t('auth.login.slogan')}</p>
          </div>

          <div className="mb-4 flex justify-end"><LanguageSwitcher /></div>

          <Card className="border border-slate-800 bg-slate-900 shadow-2xl shadow-black/40">
            <CardHeader className="space-y-1.5 pb-6">
              <CardTitle className="font-brand text-3xl font-semibold text-slate-50">
                {t('auth.login.title')}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {t('auth.login.subtitle')}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {licenseExpired && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
                >
                  {t('auth.login.licenseExpired')}
                </div>
              )}
              {passwordReset && (
                <div
                  role="status"
                  className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
                >
                  {t('auth.login.passwordReset')}
                </div>
              )}
              {pointInactive && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
                >
                  {t('auth.login.pointInactive')}
                </div>
              )}

              <form action={formAction} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {t('common.email')}
                  </label>
                  <Input
                    type="email"
                    name="email"
                    placeholder={t('auth.login.emailPlaceholder')}
                    className="bg-slate-950 border-slate-700 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                      {t('common.password')}
                    </label>
                    <Link href="/forgot-password" className="text-xs font-medium text-blue-400 hover:text-blue-300">
                      {t('auth.login.forgotPassword')}
                    </Link>
                  </div>
                  <PasswordInput
                    name="password"
                    placeholder="••••••••"
                    className="bg-slate-950 border-slate-700 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                    required
                  />
                </div>

                {state.error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    {state.error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-blue-500 hover:bg-blue-400 text-slate-950 font-semibold py-5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-950" />
                      {t('auth.login.submitting')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {t('auth.login.submit')}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>

                <div className="space-y-2 border-t border-slate-800 pt-5 text-center">
                  <p className="text-sm text-slate-400">
                    {t('auth.login.businessQuestion')}{' '}
                    <Link
                      href="/register-business"
                      className="font-medium text-blue-400 transition-colors hover:text-blue-300"
                    >
                      {t('auth.login.businessLink')}
                    </Link>
                  </p>
                  <p className="text-sm text-slate-400">
                    {t('auth.login.clientQuestion')}{' '}
                    <Link
                      href="/register-client"
                      className="font-medium text-blue-400 transition-colors hover:text-blue-300"
                    >
                      {t('auth.login.clientLink')}
                    </Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          <InstallAppButton className="mx-auto mt-4 w-auto justify-center text-sm" />

          <p className="text-center text-xs text-slate-500 mt-6">
            {t('common.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </main>
    </div>
  );
}

function LoadingFallback() {
  const { t } = useT();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
      {t('common.loading')}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoadingFallback />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
