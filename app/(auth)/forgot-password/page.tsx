'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Mail, MailCheck } from 'lucide-react';
import { requestPasswordReset } from '@/app/actions/password';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, { success: false, error: '' });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 bg-white/10 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-blue-400" />
              Mot de passe oublié
            </CardTitle>
            <CardDescription className="text-slate-300">
              Saisissez l&apos;email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {state.success ? (
              <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                <p className="flex items-center gap-2 font-semibold">
                  <MailCheck className="h-4 w-4" />
                  Demande enregistrée
                </p>
                <p className="mt-2">
                  Si un compte actif correspond à cet email, vous allez recevoir un lien de réinitialisation valable 1 heure. Pensez à vérifier vos courriers indésirables.
                </p>
              </div>
            ) : (
              <form action={formAction} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="exemple@shede.com"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                    required
                  />
                </div>

                {state.error && (
                  <p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                    {state.error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-5 rounded-xl disabled:opacity-50"
                >
                  {isPending ? 'Envoi…' : 'Envoyer le lien'}
                </Button>
              </form>
            )}

            <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
