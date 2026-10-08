'use client';

import { useActionState, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Mail, Phone, MapPin, Globe, DollarSign, Clock, Bell, LogOut, Save, Shield, Users, Loader2, ChevronRight, Settings, Receipt, CheckCircle2, Lock } from 'lucide-react';
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
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';
import { MODULE_CATEGORIES, MODULE_OPTIONS, moduleCategoryLabel, moduleDescription, moduleLabel } from '@/lib/modules';

interface SettingsPageClientProps {
  session: SessionPayload;
  structure: Structure | null;
}

/** Le franc CFA BEAC (XAF) en tête : c'est la devise du Cameroun. */
const CURRENCIES = ['XAF', 'XOF', 'NGN', 'GHS', 'MAD', 'DZD', 'TND', 'EUR', 'USD'];

const TIMEZONES = [
  'Africa/Douala', 'Africa/Lagos', 'Africa/Kinshasa', 'Africa/Abidjan', 'Africa/Dakar',
  'Africa/Bamako', 'Africa/Ouagadougou', 'Africa/Nairobi', 'Africa/Addis_Ababa',
  'Africa/Casablanca', 'Africa/Tunis', 'Africa/Cairo', 'Europe/Paris',
] as const;

const STRUCTURE_TYPES = ['RESTAURANT', 'HOTEL', 'MIXTE'] as const;

export function SettingsPageClient({ session, structure }: SettingsPageClientProps) {
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role);
  const [logoUrl, setLogoUrl] = useState<string | null>(structure?.logo_url || null);
  const { t, format } = useT();

  const currencyNames = new Intl.DisplayNames([format.intl], { type: 'currency' });
  const currencyLabel = (code: string) => `${currencyNames.of(code) ?? code} (${code})`;

  const [formState, formAction, isSubmitting] = useActionState(
    async (prev: any, formData: FormData) => {
      const result = await updateStructureSettings(prev, formData);
      if (result.success) {
        toast.success(t('settings.page.saved'));
      } else {
        toast.error(result.error || t('settings.page.saveError'));
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
            <span>{t('settings.page.breadcrumb')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-300">{t('settings.page.title')}</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-1 flex items-center gap-3">
            <Settings className="w-7 h-7 text-blue-400" />
            {t('settings.page.title')}
          </h1>
          <p className="text-slate-400">{t('settings.page.subtitle')}</p>
        </div>

        <div className="space-y-6">
          {/* ── Informations du compte ── */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-slate-50 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                {t('settings.page.account')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{t('settings.page.email')}</p>
                  <p className="text-slate-200 font-medium">{session.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{t('settings.page.role')}</p>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-300 bg-blue-500/10">
                    {t(`roles.${session.role}` as TranslationKey)}
                  </Badge>
                </div>
                {session.structureId && (
                  <div className="sm:col-span-2 space-y-1">
                    <p className="text-xs text-slate-500">{t('settings.page.structureId')}</p>
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
                    {t('settings.page.establishment')}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {t('settings.page.establishmentHint')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <input type="hidden" name="logo_url" value={logoUrl || ''} />
                  
                  <div className="flex justify-center mb-6">
                    <div className="w-full max-w-sm space-y-1.5 text-center">
                      <Label className="text-slate-300 block mb-2">{t('settings.page.logo')}</Label>
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
                        {t('settings.page.name')}
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={structure.name}
                        required
                        placeholder={t('settings.page.namePlaceholder')}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-slate-300">
                        {t('settings.page.businessEmail')}
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={structure.email}
                        required
                        placeholder={t('settings.page.businessEmailPlaceholder')}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-slate-300 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {t('settings.page.phone')}
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        defaultValue={structure.phone || ''}
                        placeholder={t('settings.page.phonePlaceholder')}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="type" className="text-slate-300">{t('settings.page.type')}</Label>
                      <select
                        id="type"
                        name="type"
                        defaultValue={structure.type || 'RESTAURANT'}
                        className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        {STRUCTURE_TYPES.map((value) => (
                          <option key={value} value={value} className="bg-slate-900">
                            {t(`settings.structureTypes.${value}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="address" className="text-slate-300 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {t('settings.page.address')}
                      </Label>
                      <Input
                        id="address"
                        name="address"
                        defaultValue={structure.address || ''}
                        placeholder={t('settings.page.addressPlaceholder')}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-slate-300">{t('settings.page.city')}</Label>
                      <Input
                        id="city"
                        name="city"
                        defaultValue={structure.city || ''}
                        placeholder={t('settings.page.cityPlaceholder')}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="country" className="text-slate-300 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {t('settings.page.country')}
                      </Label>
                      <Input
                        id="country"
                        name="country"
                        defaultValue={structure.country || t('settings.page.countryDefault')}
                        placeholder={t('settings.page.countryDefault')}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="takeaway_fee" className="text-slate-300">{t('settings.page.takeawayFee')}</Label>
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

              {/* ── Fiscalité ── */}
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl mt-6">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-slate-50 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    {t('settings.page.tax')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="niu" className="text-slate-300">{t('settings.page.niu')}</Label>
                      <Input
                        id="niu"
                        name="niu"
                        defaultValue={structure.niu ?? ''}
                        placeholder="M012345678901A"
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rccm" className="text-slate-300">{t('settings.page.rccm')}</Label>
                      <Input
                        id="rccm"
                        name="rccm"
                        defaultValue={structure.rccm ?? ''}
                        placeholder="RC/DLA/2024/B/1234"
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tax_rate" className="text-slate-300">{t('settings.page.taxRate')}</Label>
                      <Input
                        id="tax_rate"
                        name="tax_rate"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        defaultValue={structure.tax_rate ?? 0}
                        className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                      />
                      <p className="text-xs text-slate-500">{t('settings.page.taxRateHint')}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prices_include_tax" className="text-slate-300">{t('settings.page.pricesAre')}</Label>
                      <select
                        id="prices_include_tax"
                        name="prices_include_tax"
                        defaultValue={structure.prices_include_tax === false ? 'false' : 'true'}
                        className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        <option value="true" className="bg-slate-900">{t('settings.page.pricesTtc')}</option>
                        <option value="false" className="bg-slate-900">{t('settings.page.pricesHt')}</option>
                      </select>
                      <p className="text-xs text-slate-500">
                        {t('settings.page.pricesHint')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Devises & Fuseaux ── */}
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl mt-6">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-slate-50 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    {t('settings.page.currencyAndTimezone')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="currency" className="text-slate-300">{t('settings.page.currency')}</Label>
                      <select
                        id="currency"
                        name="currency"
                        defaultValue={structure.currency || 'XAF'}
                        className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        {CURRENCIES.map((code) => (
                          <option key={code} value={code} className="bg-slate-900">
                            {currencyLabel(code)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="timezone" className="text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t('settings.page.timezone')}
                      </Label>
                      <select
                        id="timezone"
                        name="timezone"
                        defaultValue={structure.timezone || 'Africa/Douala'}
                        className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz} className="bg-slate-900">
                            {t(`settings.timezones.${tz}`)}
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
                  {isSubmitting ? t('settings.page.saving') : t('settings.page.save')}
                </Button>
              </div>
            </form>
          )}

          {/* ── Modules de la licence : tous, actifs en vert, inactifs en gris ── */}
          {(session.structureId || session.organizationId) && (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="text-slate-50 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    {t('settings.page.modules')}
                  </span>
                  <span className="text-xs font-normal text-slate-400">
                    {t('settings.page.modulesCount', { active: MODULE_OPTIONS.filter((m) => session.modules?.includes(m.value)).length, total: MODULE_OPTIONS.length })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                {MODULE_CATEGORIES.map((category) => (
                  <div key={category}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{moduleCategoryLabel(t, category)}</p>
                    <div className="flex flex-wrap gap-2">
                      {MODULE_OPTIONS.filter((m) => m.category === category).map((m) => {
                        const active = Boolean(session.modules?.includes(m.value));
                        return (
                          <Badge
                            key={m.value}
                            variant="outline"
                            title={`${moduleDescription(t, m.value)} — ${active ? t('settings.page.moduleActive') : t('settings.page.moduleInactive')}`}
                            className={
                              active
                                ? 'gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-300'
                                : 'gap-1.5 border-slate-600 bg-slate-800/60 px-3 py-1 text-slate-500'
                            }
                          >
                            {active ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
                            {moduleLabel(t, m.value)}
                            <span className="sr-only">({active ? t('settings.page.moduleActive') : t('settings.page.moduleInactive')})</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-4 border-t border-slate-700/50 pt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {t('settings.page.moduleActive')}</span>
                  <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-slate-500" /> {t('settings.page.moduleInactive')}</span>
                  <span className="text-slate-500">{t('settings.page.modulesHint')}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Notifications Push ── */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-slate-50 flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-400" />
                {t('settings.page.push')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <p className="text-sm text-slate-400">
                {t('settings.page.pushHint')}
              </p>
              <PushSubscriptionToggle />
            </CardContent>
          </Card>

          {/* ── Déconnexion ── */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-red-900/30 shadow-xl">
            <CardHeader className="border-b border-red-900/20">
              <CardTitle className="text-red-400">{t('settings.page.dangerZone')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form action={logout}>
                <Button
                  type="submit"
                  variant="outline"
                  className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:text-red-300 gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {t('settings.page.logout')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
