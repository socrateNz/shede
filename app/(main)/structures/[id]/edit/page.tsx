import { requireRole } from '@/app/actions/auth';
import { createOrganizationAdmin, updateOrganization } from '@/app/actions/structures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Mail, MapPin, ChevronRight, Save, Network, ShieldCheck, Building2 } from 'lucide-react';
import Link from 'next/link';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { MODULE_CATEGORIES, MODULE_OPTIONS, moduleCategoryLabel, moduleDescription, moduleLabel, sanitizeModules } from '@/lib/modules';
import { getT } from '@/lib/i18n/server';
import { AdminAccountForm } from '@/components/organization/admin-account-form';

const inputClass =
  'bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20';

export default async function EditOrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole('SUPER_ADMIN');
  const { t } = await getT();
  const { id: organizationId } = await params;
  const { error } = await searchParams;
  const admin = getAdminSupabase();

  const [{ data: organization }, { data: points }, { data: orgAdmins }] = await Promise.all([
    admin.from('organizations').select('*').eq('id', organizationId).maybeSingle(),
    admin
      .from('structures')
      .select('id, name, city, is_active')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
    admin
      .from('users')
      .select('id, email, first_name, last_name, is_active')
      .eq('organization_id', organizationId)
      .eq('role', 'ORG_ADMIN'),
  ]);

  if (!organization) {
    return (
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="w-full rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400">
          {t('business.edit.notFound')}
        </div>
      </div>
    );
  }

  const selectedModules = sanitizeModules(organization.modules);
  const categories = MODULE_CATEGORIES;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full space-y-8">
        <Link
          href="/structures"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('business.create.back')}</span>
        </Link>

        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            {organization.name}
          </h1>
          <p className="text-slate-400">{t('business.edit.subtitle')}</p>
        </div>

        {/* Informations + modules */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-3">
              <Network className="w-5 h-5 text-blue-400" />
              {t('business.edit.infoTitle')}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8">
            <form
              action={async (formData) => {
                'use server';
                const result = await updateOrganization(organizationId, { success: false, error: '' }, formData);
                if (!result.success) {
                  redirect(`/structures/${organizationId}/edit?error=${encodeURIComponent(result.error)}`);
                }
                redirect('/structures');
              }}
              className="space-y-8"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Network className="w-4 h-4 text-blue-400" />
                    {t('business.form.organizationName')}
                  </label>
                  <Input name="organizationName" defaultValue={organization.name || ''} className={inputClass} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    {t('business.form.organizationEmail')}
                  </label>
                  <Input name="organizationEmail" type="email" defaultValue={organization.email || ''} className={inputClass} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    {t('business.form.cityOptional')}
                  </label>
                  <Input name="city" defaultValue={organization.city || ''} className={inputClass} />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-blue-400" />
                  {t('business.form.licenseModulesApplied')}
                </label>

                {categories.map((category) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 pl-1">
                      {moduleCategoryLabel(t, category)}
                    </p>
                    <div className="grid gap-2">
                      {MODULE_OPTIONS.filter((m) => m.category === category).map((module) => {
                        const isChecked = selectedModules.includes(module.value);
                        return (
                          <label
                            key={module.value}
                            className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer ${
                              isChecked
                                ? 'bg-blue-500/10 border-blue-500/50'
                                : 'bg-slate-900/30 border-slate-600/50 hover:border-slate-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              name="modules"
                              value={module.value}
                              defaultChecked={isChecked}
                              className="mt-0.5 w-5 h-5 rounded border-slate-500 text-blue-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-200 text-sm">{moduleLabel(t, module.value)}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{moduleDescription(t, module.value)}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 font-semibold"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {t('business.edit.saveChanges')}
                </Button>
                <Link href="/structures" className="sm:flex-none">
                  <Button type="button" variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
                    {t('common.cancel')}
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Points */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-3">
              <Building2 className="w-5 h-5 text-blue-400" />
              {t('business.edit.pointsTitle', { count: points?.length ?? 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {!points?.length ? (
              <p className="text-sm text-slate-400">
                {t('business.edit.noPoints')}
              </p>
            ) : (
              <ul className="space-y-2">
                {points.map((point) => (
                  <li key={point.id} className="flex items-center justify-between rounded-lg border border-slate-700 px-4 py-3 text-sm">
                    <span className="text-slate-100">
                      {point.name}
                      {point.city ? <span className="text-slate-500"> · {point.city}</span> : null}
                    </span>
                    <span className={point.is_active === false ? 'text-red-400' : 'text-green-400'}>
                      {point.is_active === false ? t('business.edit.pointDisabled') : t('business.edit.pointActive')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Administrateurs de l'organisation */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              {t('business.edit.orgAdminsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {!orgAdmins?.length ? (
              <p className="text-sm text-amber-400">
                {t('business.edit.noOrgAdmins')}
              </p>
            ) : (
              <ul className="space-y-2">
                {orgAdmins.map((user) => (
                  <li key={user.id} className="rounded-lg border border-slate-700 px-4 py-3 text-sm">
                    <span className="text-slate-100">
                      {`${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email}
                    </span>
                    <span className="text-slate-500"> · {user.email}</span>
                    {!user.is_active && <span className="text-red-400"> · {t('business.edit.adminInactive')}</span>}
                  </li>
                ))}
              </ul>
            )}
            <AdminAccountForm
              action={createOrganizationAdmin.bind(null, organizationId)}
              submitLabel={t('business.edit.createOrgAdmin')}
            />
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500 text-center">
          {t('business.edit.footer')}
        </p>
      </div>
    </div>
  );
}
