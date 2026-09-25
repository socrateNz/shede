'use client';

import { login } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Mail, Lock, ArrowRight } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4" />
          <h1 className="text-2xl font-bold text-white">Shede POS</h1>
          <p className="text-slate-400 text-sm mt-1">Plateforme de gestion professionnelle</p>
        </div>

        <Card className="border-0 bg-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10" />

          <CardHeader className="space-y-2 pb-6 relative">
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <LogIn className="w-6 h-6 text-blue-400" />
              Connexion
            </CardTitle>
            <CardDescription className="text-slate-300">
              Accédez à votre espace professionnel
            </CardDescription>
          </CardHeader>

          <CardContent className="relative">
            {licenseExpired && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
              >
                Votre licence a expiré. Contactez le support pour prolonger votre abonnement.
              </div>
            )}
            {passwordReset && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
              >
                Mot de passe enregistré. Vous pouvez vous connecter.
              </div>
            )}
            {pointInactive && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
              >
                Ce point a été désactivé. Contactez l&apos;administrateur de votre organisation.
              </div>
            )}

            <form action={formAction} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  Email
                </label>
                <Input
                  type="email"
                  name="email"
                  placeholder="exemple@shede.com"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    Mot de passe
                  </label>
                  <Link href="/forgot-password" className="text-xs font-medium text-blue-400 hover:text-blue-300">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <Input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
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
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Connexion...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Se connecter
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>

              <div className="space-y-2 pt-4 text-center">
                <p className="text-sm text-slate-400">
                  Établissement professionnel ?{' '}
                  <Link
                    href="/register-business"
                    className="font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    Créer un compte business
                  </Link>
                </p>
                <p className="text-sm text-slate-400">
                  Client particulier ?{' '}
                  <Link
                    href="/register-client"
                    className="font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    S&apos;inscrire
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2024 Shede - Tous droits réservés
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
          Chargement…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
