'use client';

import { useActionState, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2, Mail, Phone, MapPin, Globe, DollarSign,
  Clock, Bell, LogOut, Save, Shield, Users, Loader2,
  ChevronRight, Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PushSubscriptionToggle } from '@/components/push-subscription-toggle';
import { ImageUpload } from '@/components/image-upload';
import { logout } from '@/app/actions/auth';
import { updateStructureSettings } from '@/app/actions/structures';
import type { SessionPayload } from '@/lib/auth';
import type { Structure } from '@/lib/supabase';

interface SettingsPageClientProps {
  session: SessionPayload;
  structure: Structure | null;
}

const CURRENCIES = [
  { code: 'XOF', label: 'Franc CFA UEMOA (XOF)' },
  { code: 'XAF', label: 'Franc CFA BEAC (XAF)' },
  { code: 'GHS', label: 'Cedi Ghanéen (GHS)' },
  { code: 'NGN', label: 'Naira Nigérian (NGN)' },
  { code: 'MAD', label: 'Dirham Marocain (MAD)' },
  { code: 'DZD', label: 'Dinar Algérien (DZD)' },
  { code: 'TND', label: 'Dinar Tunisien (TND)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'USD', label: 'Dollar US (USD)' },
];

const TIMEZONES = [
  { tz: 'Africa/Abidjan',     label: 'Abidjan — UTC+0' },
  { tz: 'Africa/Dakar',       label: 'Dakar — UTC+0' },
  { tz: 'Africa/Bamako',      label: 'Bamako — UTC+0' },
  { tz: 'Africa/Ouagadougou', label: 'Ouagadougou — UTC+0' },
  { tz: 'Africa/Lagos',       label: 'Lagos — UTC+1' },
  { tz: 'Africa/Douala',      label: 'Douala — UTC+1' },
  { tz: 'Africa/Kinshasa',    label: 'Kinshasa — UTC+1' },
  { tz: 'Africa/Nairobi',     label: 'Nairobi — UTC+3' },
  { tz: 'Africa/Addis_Ababa', label: 'Addis Abeba — UTC+3' },
  { tz: 'Africa/Casablanca',  label: 'Casablanca — UTC+0/+1' },
  { tz: 'Africa/Tunis',       label: 'Tunis — UTC+1' },
  { tz: 'Africa/Cairo',       label: 'Le Caire — UTC+2' },
  { tz: 'Europe/Paris',       label: 'Paris — UTC+1/+2' },
];

const STRUCTURE_TYPES = [
  { value: 'RESTAURANT', label: '🍽️ Restaurant' },
  { value: 'HOTEL',      label: '🏨 Hôtel' },
  { value: 'MIXTE',      label: '🏩 Hôtel-Restaurant' },
];

const MODULE_LABELS: Record<string, string> = {
  POS:       '🖥️ Caisse (POS)',
  HOTEL:     '🏨 Hôtel',
  STOCK:     '📦 Stock',
  PROMOTION: '🏷️ Promotions',
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  ADMIN:       'Administrateur',
  MANAGER:     'Manager',
  CAISSE:      'Caisse',
  SERVEUR:     'Serveur',
  RECEPTION:   'Réception',
  CUISINIER:   'Cuisinier',
  BAR:         'Bar',
  LIVREUR:     'Livreur',
  COMPTABLE:   'Comptable',
  MAGASINIER:  'Magasinier',
  RH:          'Ressources Humaines',
};

export function SettingsPageClient({ session, structure }: SettingsPageClientProps) {
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role);
  const [logoUrl, setLogoUrl] = useState<string | null>(structure?.logo_url || null);

  const [formState, formAction, isSubmitting] = useActionState(
    async (prev: any, formData: FormData) => {
      const result = await updateStructureSettings(prev, formData);
      if (result.success) {
        toast.success('Paramètres sauvegardés avec succès !');
      } else {
        toast.error(result.error || 'Erreur lors de la sauvegarde');
      }
      return result;
    },
    { success: false, error: '' }
  );

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Blobs décoratifs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
            <span>Dashboard</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-300">Paramètres</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1 flex items-center gap-3">
            <Settings className="w-7 h-7 text-blue-400" />
            Paramètres
          </h1>
          <p className="text-slate-400">Configurez votre établissement et vos préférences</p>
        </div>

        <div className="space-y-6">
          {/* ── Informations du compte ── */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-slate-50 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Informations du compte
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-slate-200 font-medium">{session.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Rôle</p>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-300 bg-blue-500/10">
                    {ROLE_LABELS[session.role] || session.role}
                  </Badge>
                </div>
                {session.structureId && (
                  <div className="sm:col-span-2 space-y-1">
                    <p className="text-xs text-slate-500">ID de structure</p>
                    <p className="text-slate-400 font-mono text-sm break-all">{session.structureId}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Paramètres de l'établissement (ADMIN/MANAGER) ── */}
          {isAdmin && structure && (
            <form action={formAction}>
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-slate-50 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    Établissement
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Informations de base de votre restaurant
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <input type="hidden" name="logo_url" value={logoUrl || ''} />
                  
                  <div className="flex justify-center mb-6">
                    <div className="w-full max-w-sm space-y-1.5 text-center">
                      <Label className="text-slate-300 block mb-2">Logo de l'établissement (Max 1 image)</Label>
                      <ImageUpload
                        value={logoUrl}
                        onChange={(url) => setLogoUrl(url)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-slate-300">
                        Nom de l&apos;établissement *
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={structure.name}
                        required
                        placeholder="Mon Restaurant"
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-slate-300">
                        Email professionnel *
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={structure.email}
                        required
                        placeholder="contact@monrestaurant.com"
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-slate-300 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Téléphone
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        defaultValue={structure.phone || ''}
                        placeholder="+225 07 00 00 00 00"
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="type" className="text-slate-300">Type d&apos;établissement</Label>
                      <select
                        id="type"
                        name="type"
                        defaultValue={structure.type || 'RESTAURANT'}
                        className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        {STRUCTURE_TYPES.map(({ value, label }) => (
                          <option key={value} value={value} className="bg-slate-900">
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="address" className="text-slate-300 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Adresse
                      </Label>
                      <Input
                        id="address"
                        name="address"
                        defaultValue={structure.address || ''}
                        placeholder="Rue, quartier..."
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-slate-300">Ville</Label>
                      <Input
                        id="city"
                        name="city"
                        defaultValue={structure.city || ''}
                        placeholder="Abidjan"
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="country" className="text-slate-300 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Pays
                      </Label>
                      <Input
                        id="country"
                        name="country"
                        defaultValue={structure.country || 'Côte d\'Ivoire'}
                        placeholder="Côte d'Ivoire"
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tax_rate" className="text-slate-300">Taux de TVA (%)</Label>
                      <Input
                        id="tax_rate"
                        name="tax_rate"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        defaultValue={structure.tax_rate ?? 0}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="takeaway_fee" className="text-slate-300">Frais d'emballage (À emporter)</Label>
                      <Input
                        id="takeaway_fee"
                        name="takeaway_fee"
                        type="number"
                        min={0}
                        defaultValue={structure.takeaway_fee ?? 0}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Devises & Fuseaux ── */}
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl mt-6">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-slate-50 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    Devise & Fuseau horaire
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="currency" className="text-slate-300">Devise</Label>
                      <select
                        id="currency"
                        name="currency"
                        defaultValue={structure.currency || 'XOF'}
                        className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        {CURRENCIES.map(({ code, label }) => (
                          <option key={code} value={code} className="bg-slate-900">
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="timezone" className="text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Fuseau horaire
                      </Label>
                      <select
                        id="timezone"
                        name="timezone"
                        defaultValue={structure.timezone || 'Africa/Abidjan'}
                        className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        {TIMEZONES.map(({ tz, label }) => (
                          <option key={tz} value={tz} className="bg-slate-900">
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bouton sauvegarde */}
              <div className="mt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 gap-2 min-w-[160px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          )}

          {/* ── Modules actifs ── */}
          {structure?.modules && structure.modules.length > 0 && (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="text-slate-50 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Modules actifs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="flex flex-wrap gap-2">
                  {structure.modules.map((mod) => (
                    <Badge
                      key={mod}
                      variant="outline"
                      className="border-purple-500/30 text-purple-300 bg-purple-500/10 px-3 py-1"
                    >
                      {MODULE_LABELS[mod] || mod}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Pour activer ou désactiver des modules, contactez le support Shede.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Notifications Push ── */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-slate-50 flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-400" />
                Notifications push
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <p className="text-sm text-slate-400">
                Recevez des alertes en temps réel pour les nouvelles commandes et réservations.
              </p>
              <PushSubscriptionToggle />
            </CardContent>
          </Card>

          {/* ── Déconnexion ── */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-red-900/30 shadow-xl">
            <CardHeader className="border-b border-red-900/20">
              <CardTitle className="text-red-400">Zone dangereuse</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form action={logout}>
                <Button
                  type="submit"
                  variant="outline"
                  className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:text-red-300 gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
