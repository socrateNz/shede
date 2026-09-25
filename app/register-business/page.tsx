'use client';

import { registerBusiness } from '@/app/actions/structures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BUSINESS_TRIAL_MONTHS, getBusinessTrialEndDate } from '@/lib/trial';
import { MODULE_OPTIONS, moduleDescription, moduleLabel } from '@/lib/modules';
import { useT } from '@/lib/i18n/client';
import { LanguageSwitcher } from '@/components/language-switcher';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Mail,
  MapPin,
  User,
  Lock,
  ChevronRight,
  Check,
  Gift,
  Calendar,
} from 'lucide-react';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterBusinessPage() {
  const router = useRouter();
  const { t, format } = useT();
  const trialEndDate = useMemo(() => getBusinessTrialEndDate(), []);
  const trialEndLabel = format.date(trialEndDate, { dateStyle: 'long' });
  const months = BUSINESS_TRIAL_MONTHS;

  const [state, formAction, isPending] = useActionState(registerBusiness, {
    success: false,
    error: '',
  });

  const [selectedModules, setSelectedModules] = useState<string[]>(['POS']);

  useEffect(() => {
    if (state.success && state.redirect) {
      router.push(state.redirect);
    }
  }, [state.success, state.redirect, router]);

  const handleModuleToggle = (moduleValue: string) => {
    setSelectedModules((prev) => {
      if (prev.includes(moduleValue)) {
        return prev.filter((m) => m !== moduleValue);
      }
      return [...prev, moduleValue];
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <Link
          href="/"
          className="group mb-6 inline-flex cursor-pointer items-center gap-2 text-slate-400 transition-all duration-300 hover:text-blue-400"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>{t('common.backToHome')}</span>
        </Link>

        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-4 py-2 backdrop-blur-sm">
            <span className="text-sm font-medium text-blue-400">{t('business.register.badge')}</span>
            <LanguageSwitcher className="ml-2" />
          </div>
          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            {t('business.register.title')}
          </h1>
          <p className="text-slate-400">
            {t('business.register.subtitle')}
          </p>
        </div>

        <div
          role="status"
          className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5"
        >
          <div className="flex gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
              <Gift className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-emerald-300">
                {t('business.register.trialTitle', { months })}
              </p>
              <p className="text-sm text-slate-300">
                {t('business.register.trialText', { months })}
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-emerald-200/90">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{t('business.register.trialEnd', { date: trialEndLabel })}</span>
              </p>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border-slate-700/50 bg-slate-800/50 shadow-2xl backdrop-blur-sm">
          <CardHeader className="border-b border-slate-700/50 pb-6">
            <CardTitle className="flex items-center gap-3 text-2xl font-bold text-white">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-2">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              {t('business.register.cardTitle')}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8">
            <form action={formAction} className="space-y-8">
              <input type="hidden" name="modules" value={selectedModules.join(',')} />

              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-700 pb-2 text-slate-300">
                  <Building2 className="h-4 w-4 text-blue-400" />
                  <h3 className="font-semibold">{t('business.form.sectionOrganization')}</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="group space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <Building2 className="h-4 w-4 text-blue-400" />
                      {t('business.form.organizationName')}
                    </label>
                    <Input
                      name="organizationName"
                      type="text"
                      placeholder={t('business.form.organizationNamePlaceholder')}
                      className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                      required
                    />
                  </div>

                  <div className="group space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <Mail className="h-4 w-4 text-blue-400" />
                      {t('business.form.organizationEmail')}
                    </label>
                    <Input
                      name="organizationEmail"
                      type="email"
                      placeholder={t('business.form.organizationEmailPlaceholder')}
                      className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="group space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <MapPin className="h-4 w-4 text-blue-400" />
                      {t('business.form.city')}
                    </label>
                    <Input
                      name="city"
                      type="text"
                      placeholder={t('business.form.cityPlaceholder')}
                      className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                      required
                    />
                  </div>

                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <ChevronRight className="h-4 w-4 text-blue-400" />
                    {t('business.form.modulesToEnable')}
                  </label>
                  <div className="grid gap-3">
                    {MODULE_OPTIONS.map((module) => (
                      <label
                        key={module.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all duration-300 ${
                          selectedModules.includes(module.value)
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-slate-600 bg-slate-900/30 hover:border-slate-500'
                        }`}
                        onClick={() => handleModuleToggle(module.value)}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
                              selectedModules.includes(module.value)
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-slate-500 bg-transparent'
                            }`}
                          >
                            {selectedModules.includes(module.value) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-200">{moduleLabel(t, module.value)}</div>
                          <div className="text-sm text-slate-400">{moduleDescription(t, module.value)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {t('business.form.modulesSelected', { count: selectedModules.length })}
                  </p>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-2 border-b border-slate-700 pb-2 text-slate-300">
                  <User className="h-4 w-4 text-purple-400" />
                  <h3 className="font-semibold">{t('business.form.sectionAdmin')}</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="group space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <User className="h-4 w-4 text-purple-400" />
                      {t('business.form.firstName')}
                    </label>
                    <Input
                      name="adminFirstName"
                      type="text"
                      placeholder={t('business.form.firstNamePlaceholder')}
                      className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                      required
                    />
                  </div>

                  <div className="group space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <User className="h-4 w-4 text-purple-400" />
                      {t('business.form.lastName')}
                    </label>
                    <Input
                      name="adminLastName"
                      type="text"
                      placeholder={t('business.form.lastNamePlaceholder')}
                      className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="group space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <Mail className="h-4 w-4 text-purple-400" />
                      {t('business.form.adminEmail')}
                    </label>
                    <Input
                      name="adminEmail"
                      type="email"
                      placeholder={t('business.form.adminEmailPlaceholder')}
                      className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                      required
                    />
                  </div>

                  <div className="group space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <Lock className="h-4 w-4 text-purple-400" />
                      {t('business.form.password')}
                    </label>
                    <Input
                      name="adminPassword"
                      type="password"
                      placeholder="••••••••"
                      className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                      required
                      minLength={8}
                    />
                    <p className="mt-1 text-xs text-slate-500">{t('business.form.passwordHint')}</p>
                  </div>
                </div>
              </div>

              {state.error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {state.error}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4 border-t border-slate-700 pt-6 sm:flex-row">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-2.5 font-semibold text-white transition-all duration-300 hover:scale-105 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t('business.register.submitting')}
                    </span>
                  ) : (
                    <span>{t('business.register.submit', { months })}</span>
                  )}
                </Button>

                <Link href="/login" className="flex-1 sm:flex-none">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full cursor-pointer border-slate-600 text-slate-300 transition-all duration-300 hover:bg-slate-700 hover:text-white"
                  >
                    {t('business.register.hasAccount')}
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-slate-500">
          {t('business.register.footer', { months })}
        </p>
      </div>
    </div>
  );
}
