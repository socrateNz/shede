'use client';

import { createClient } from '@/app/actions/clients';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { ArrowLeft, User, Phone, Mail, Calendar, Heart, MessageSquare } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewClientPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createClient as any,
    { success: false, error: '' }
  );

  useEffect(() => {
    if (state.success) {
      router.push('/clients');
    }
  }, [state.success, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto relative">
        {/* Back Button */}
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-pink-400 mb-6 transition-all duration-300 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Retour aux clients</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Nouveau client
          </h1>
          <p className="text-slate-400">Ajoutez un client à votre base de données CRM</p>
        </div>

        {/* Formulaire Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-2xl">
          <CardHeader className="border-b border-slate-700/50 pb-6">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl">
                <User className="w-5 h-5 text-white" />
              </div>
              Informations du client
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8">
            <form action={formAction} className="space-y-6">
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-pink-400" />
                    Prénom *
                  </label>
                  <Input
                    name="firstName"
                    type="text"
                    placeholder="Jean"
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20"
                    required
                  />
                </div>

                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-pink-400" />
                    Nom *
                  </label>
                  <Input
                    name="lastName"
                    type="text"
                    placeholder="Dupont"
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-pink-400" />
                    Téléphone
                  </label>
                  <Input
                    name="phone"
                    type="tel"
                    placeholder="+225 0102030405"
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20"
                  />
                </div>

                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-pink-400" />
                    Email
                  </label>
                  <Input
                    name="email"
                    type="email"
                    placeholder="client@email.com"
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20"
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-pink-400" />
                  Date de naissance
                </label>
                <Input
                  name="birthday"
                  type="date"
                  className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20"
                />
              </div>

              <div className="space-y-2 group">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-400" />
                  Allergies / Restrictions
                </label>
                <Textarea
                  name="allergies"
                  placeholder="Ex: Arachides, Gluten..."
                  className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20 resize-none"
                  rows={2}
                />
              </div>

              <div className="space-y-2 group">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pink-400" />
                  Préférences
                </label>
                <Textarea
                  name="preferences"
                  placeholder="Ex: Table près de la fenêtre, sans glaçons..."
                  className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20 resize-none"
                  rows={2}
                />
              </div>

              <div className="space-y-2 group">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  Notes internes
                </label>
                <Textarea
                  name="notes"
                  placeholder="Notes visibles uniquement par le staff..."
                  className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20 resize-none"
                  rows={2}
                />
              </div>

              {/* Message d'erreur */}
              {state.error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    {state.error}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 pt-6 border-t border-slate-700">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Création...' : 'Créer le client'}
                </Button>

                <Link href="/clients" className="flex-1 sm:flex-none">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300 cursor-pointer"
                  >
                    Annuler
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
