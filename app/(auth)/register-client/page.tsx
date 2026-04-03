'use client';

import { registerClient } from '@/app/actions/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';

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
    <div className='w-full bg-white'>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white shadow-xl border-slate-100">
          <CardHeader className="text-center pb-2">
            <Link href="/" className="inline-block mb-4">
              <img src="/logo.webp" alt="Shede" className="w-12 h-12 rounded-xl mx-auto border border-slate-100 shadow-sm" />
            </Link>
            <CardTitle className="text-2xl font-bold text-slate-900">Créer mon compte Client</CardTitle>
            <CardDescription className="text-slate-500">
              Rejoignez Shede pour réserver vos chambres et commander vos repas facilement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Prénom *</label>
                  <Input
                    type="text"
                    name="firstName"
                    placeholder="Jean"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Nom *</label>
                  <Input
                    type="text"
                    name="lastName"
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Email *</label>
                <Input
                  type="email"
                  name="email"
                  placeholder="jean.dupont@example.com"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Mot de passe *</label>
                <Input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {state.error && (
                <div className="p-3 text-sm rounded-md bg-red-50 text-red-600 border border-red-100">
                  {state.error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 mt-2"
              >
                {isPending ? 'Création en cours...' : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    S'inscrire
                  </>
                )}
              </Button>

              <div className="text-center mt-6">
                <p className="text-sm text-slate-500">
                  Déjà un compte ?{' '}
                  <Link href="/login" className="text-blue-600 font-semibold hover:underline">
                    Se connecter
                  </Link>
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  <Link href="/" className="inline-flex items-center text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Retour à l'accueil
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
