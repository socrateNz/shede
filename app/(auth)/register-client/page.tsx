'use client';

import { registerClient } from '@/app/actions/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Mail, Lock, User, Sparkles, CheckCircle } from 'lucide-react';

export default function RegisterClientPage() {
  const router = useRouter();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Shede</h1>
          <p className="text-slate-500 text-sm mt-1">Créez votre espace client</p>
        </div>

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-indigo-600/5" />

          <CardHeader className="text-center pb-4 relative">
            <div className="inline-flex mx-auto bg-blue-100 p-3 rounded-full mb-4">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Créer mon compte</CardTitle>
            <CardDescription className="text-slate-500">
            </CardDescription>
          </CardHeader>

          <CardContent className="relative">
            <form action={formAction} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    Prénom
                  </label>
                  <Input
                    type="text"
                    name="firstName"
                    placeholder="Jean"
                    className="bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nom</label>
                  <Input
                    type="text"
                    name="lastName"
                    placeholder="Dupont"
                    className="bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  Email
                </label>
                <Input
                  type="email"
                  name="email"
                  placeholder="jean.dupont@example.com"
                  className="bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  Mot de passe
                </label>
                <Input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  className="bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
                  required
                  minLength={6}
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 6 caractères</p>
              </div>

              {state.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600 flex items-center gap-2">
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
                    Création en cours...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Créer mon compte
                  </div>
                )}
              </Button>

              <div className="text-center pt-2">
                <p className="text-sm text-slate-500">
                  Déjà un compte ?{' '}
                  <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                    Se connecter
                  </Link>
                </p>
              </div>

              <div className="text-center">
                <Link href="/" className="inline-flex items-center text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Retour à l'accueil
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6">
          En créant un compte, vous acceptez nos conditions d'utilisation
        </p>
      </div>
    </div>
  );
}