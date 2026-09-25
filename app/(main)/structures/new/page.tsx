'use client';

import { createOrganizationWithAdmin } from '@/app/actions/structures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { ArrowLeft, Building2, Mail, MapPin, User, Lock, ChevronRight, Check, Network } from 'lucide-react';
import { MODULE_CATEGORIES, MODULE_OPTIONS, moduleCategoryLabel, moduleDescription, moduleLabel } from '@/lib/modules';
import { useT } from '@/lib/i18n/client';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewOrganizationPage() {
  const router = useRouter();
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(createOrganizationWithAdmin, {
    success: false,
    error: '',
  });

  const [selectedModules, setSelectedModules] = useState<string[]>(['POS']);

  useEffect(() => {
    if (state.success) {
      router.push('/structures');
    }
  }, [state.success, router]);

  const handleModuleToggle = (moduleValue: string) => {
    setSelectedModules(prev => {
      if (prev.includes(moduleValue)) {
        return prev.filter(m => m !== moduleValue);
      } else {
        return [...prev, moduleValue];
      }
    });
  };

  const modules = MODULE_OPTIONS;
  const categories = MODULE_CATEGORIES;


  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Back Button avec animation */}
        <Link
          href="/structures"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{t('business.create.back')}</span>
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
            <span className="text-sm text-blue-400 font-medium">{t('business.create.badge')}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            {t('business.create.title')}
          </h1>
          <p className="text-slate-400">
            {t('business.create.subtitle')}
          </p>
        </div>

        {/* Formulaire Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <CardHeader className="border-b border-slate-700/50 pb-6">
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              {t('business.create.cardTitle')}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8">
            <form action={formAction} className="space-y-8">
              {/* Champ caché pour les modules */}
              <input type="hidden" name="modules" value={selectedModules.join(',')} />

              {/* Section Structure */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold">{t('business.form.sectionOrganization')}</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-400" />
                      {t('business.form.organizationName')}
                    </label>
                    <Input
                      name="organizationName"
                      type="text"
                      placeholder={t('business.form.organizationNamePlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-400" />
                      {t('business.form.organizationEmail')}
                    </label>
                    <Input
                      name="organizationEmail"
                      type="email"
                      placeholder={t('business.form.organizationEmailPlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      {t('business.form.city')}
                    </label>
                    <Input
                      name="city"
                      type="text"
                      placeholder={t('business.form.cityPlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Network className="w-4 h-4 text-blue-400" />
                      {t('business.form.maxPoints')}
                    </label>
                    <Input
                      name="maxPoints"
                      type="number"
                      min={1}
                      defaultValue={1}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>
                </div>

                {/* Modules avec Checkboxes — groupés par catégorie */}
                <div className="space-y-4">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-blue-400" />
                    {t('business.form.licenseModules')}
                  </label>

                  {categories.map((category) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 pl-1">
                        {moduleCategoryLabel(t, category)}
                      </p>
                      <div className="grid gap-2">
                        {modules.filter(m => m.category === category).map((module) => (
                          <label
                            key={module.value}
                            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all duration-300 cursor-pointer ${
                              selectedModules.includes(module.value)
                                ? 'bg-blue-500/10 border-blue-500/50'
                                : 'bg-slate-900/30 border-slate-600/50 hover:border-slate-500'
                            }`}
                            onClick={() => handleModuleToggle(module.value)}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                selectedModules.includes(module.value)
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-slate-500 bg-transparent'
                              }`}>
                                {selectedModules.includes(module.value) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-200 text-sm">{moduleLabel(t, module.value)}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{moduleDescription(t, module.value)}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  <p className="text-xs text-slate-500 mt-1 pl-1">
                    {t('business.form.modulesSelected', { count: selectedModules.length })} ·{' '}
                    <span className="text-slate-600">{t('business.form.modulesEditable')}</span>
                  </p>
                </div>

              </div>

              {/* Section Admin */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <h3 className="font-semibold">{t('business.form.sectionAdmin')}</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-400" />
                      {t('business.form.firstName')}
                    </label>
                    <Input
                      name="adminFirstName"
                      type="text"
                      placeholder={t('business.form.firstNamePlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-400" />
                      {t('business.form.lastName')}
                    </label>
                    <Input
                      name="adminLastName"
                      type="text"
                      placeholder={t('business.form.lastNamePlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-400" />
                      {t('business.form.adminEmail')}
                    </label>
                    <Input
                      name="adminEmail"
                      type="email"
                      placeholder={t('business.form.adminEmailPlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-purple-400" />
                      {t('business.form.password')}
                    </label>
                    <Input
                      name="adminPassword"
                      type="password"
                      placeholder="••••••••"
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                      minLength={8}
                    />
                    <p className="text-xs text-slate-500 mt-1">{t('business.form.passwordHint')}</p>
                  </div>
                </div>
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
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('business.create.submitting')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {t('business.create.submit')}
                    </div>
                  )}
                </Button>

                <Link href="/structures" className="flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300 cursor-pointer"
                  >
                    {t('common.cancel')}
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            {t('business.create.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}