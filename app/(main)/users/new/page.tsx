'use client';

import { createUser } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import { ArrowLeft, UserPlus, Mail, Lock, Briefcase, User, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NewUserPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createUser, {
    success: false,
    error: '',
  });

  useEffect(() => {
    if (state.success) {
      router.push('/users');
    }
  }, [state.success, router]);

  const roles = [
    { value: 'ADMIN', label: 'Administrateur', icon: '👑', description: 'Accès complet à la gestion' },
    { value: 'CAISSE', label: 'Caisse', icon: '💳', description: 'Gestion des paiements et factures' },
    { value: 'SERVEUR', label: 'Serveur', icon: '🍽️', description: 'Prise de commandes et service' },
    { value: 'RECEPTION', label: 'Réception', icon: '🏨', description: 'Gestion des réservations' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl relative">
        {/* Back Button */}
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Retour à l'équipe</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
            <UserPlus className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-400 font-medium">Nouveau membre</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            Ajouter un membre
          </h1>
          <p className="text-slate-400">Créez un nouveau compte pour votre personnel</p>
        </div>

        {/* Formulaire Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <CardHeader className="border-b border-slate-700/50 pb-6">
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              Formulaire d'inscription
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8">
            <form action={formAction} className="space-y-8">
              {/* Section Informations personnelles */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <User className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold">Informations personnelles</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      Prénom *
                    </label>
                    <Input
                      type="text"
                      name="firstName"
                      placeholder="Jean"
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-400" />
                      Nom *
                    </label>
                    <Input
                      type="text"
                      name="lastName"
                      placeholder="Dupont"
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    Email *
                  </label>
                  <Input
                    type="email"
                    name="email"
                    placeholder="jean.dupont@restaurant.com"
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300 group-hover:border-slate-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">L'email servira d'identifiant de connexion</p>
                </div>

                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    Mot de passe *
                  </label>
                  <Input
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 transition-all duration-300 group-hover:border-slate-500"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-slate-500 mt-1">Minimum 6 caractères</p>
                </div>
              </div>

              {/* Section Rôle */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <Briefcase className="w-4 h-4 text-purple-400" />
                  <h3 className="font-semibold">Attribution du rôle</h3>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-purple-400" />
                    Rôle *
                  </label>
                  <select
                    name="role"
                    className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 cursor-pointer hover:border-slate-500"
                    defaultValue="SERVEUR"
                    required
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.icon} {role.label} - {role.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cartes des rôles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {roles.map((role) => (
                    <div
                      key={role.value}
                      className="p-3 rounded-lg bg-slate-900/30 border border-slate-700"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{role.icon}</span>
                        <span className="font-medium text-slate-200">{role.label}</span>
                      </div>
                      <p className="text-xs text-slate-400">{role.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message d'erreur */}
              {state.error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {state.error}
                  </div>
                </div>
              )}

              {/* Message de succès */}
              {state.success && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Utilisateur créé avec succès ! Redirection...
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Création en cours...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Ajouter le membre
                    </div>
                  )}
                </Button>

                <Link href="/users" className="flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300"
                  >
                    Annuler
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            L'utilisateur recevra un email de bienvenue avec ses identifiants de connexion
          </p>
        </div>
      </div>
    </div>
  );
}