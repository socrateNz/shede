import { requireRole } from '@/app/actions/auth';
import { getAllOrganizations } from '@/app/actions/structures';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Network, Plus, Edit2, Trash2, Calendar, CheckCircle, XCircle, AlertTriangle, Building2, ShieldCheck } from 'lucide-react';
import { firstOf, isLicenseValid } from '@/lib/license';
import { getT } from '@/lib/i18n/server';

type I18n = Awaited<ReturnType<typeof getT>>;

function toLocalDateTimeInput(isoDate?: string | null) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getLicenseStatus({ t, format }: I18n, expiresAt: string | null) {
  if (!expiresAt) return { status: 'inactive', label: t('business.list.statusUndefined'), color: 'text-slate-400', bg: 'bg-slate-500/10' };

  const now = new Date();
  const expiry = new Date(expiresAt);

  if (expiry < now) {
    return { status: 'expired', label: t('business.list.statusExpired'), color: 'text-red-400', bg: 'bg-red-500/10' };
  }

  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 7) {
    return { status: 'warning', label: t('business.list.statusExpiresIn', { days: daysLeft }), color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  }

  return { status: 'active', label: t('business.list.statusValidUntil', { date: format.date(expiry) }), color: 'text-green-400', bg: 'bg-green-500/10' };
}

function getOrganizationsStats(organizations: any[]) {
  const licenses = organizations.map((o) => firstOf(o.licenses));
  const total = organizations.length;
  const active = licenses.filter((l) => l?.is_active === true).length;
  const expiringSoon = licenses.filter((l) => {
    if (!l?.expires_at) return false;
    const daysLeft = Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7 && daysLeft > 0;
  }).length;
  const points = organizations.reduce((sum, o) => sum + (o.structures?.length ?? 0), 0);

  return { total, active, expiringSoon, points };
}

export default async function StructuresPage() {
  await requireRole('SUPER_ADMIN');
  const i18n = await getT();
  const { t, format } = i18n;
  const organizations = await getAllOrganizations();
  const stats = getOrganizationsStats(organizations);

  const statCards = [
    { label: t('business.list.statOrganizations'), value: stats.total, icon: Network, color: 'text-white', iconColor: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: t('business.list.statPoints'), value: stats.points, icon: Building2, color: 'text-white', iconColor: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: t('business.list.statActiveLicenses'), value: stats.active, icon: CheckCircle, color: 'text-green-400', iconColor: 'text-green-400', bg: 'bg-green-500/10' },
    { label: t('business.list.statExpiringSoon'), value: stats.expiringSoon, icon: AlertTriangle, color: 'text-yellow-400', iconColor: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              {t('business.list.title')}
            </h1>
            <p className="text-slate-400">{t('business.list.subtitle')}</p>
          </div>
          <Link href="/structures/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
              <Plus className="w-4 h-4 mr-2" />
              {t('business.list.newOrganization')}
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                  <div className="text-sm text-slate-400">{card.label}</div>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon className={`w-6 h-6 ${card.iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Liste */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <Network className="w-5 h-5 text-blue-400" />
              {t('business.list.allTitle', { count: organizations.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {organizations.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Network className="w-10 h-10 mx-auto mb-4 opacity-30" />
                <p className="text-lg">{t('business.list.emptyTitle')}</p>
                <p className="text-sm mt-2">{t('business.list.emptyText')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {organizations.map((organization: any) => {
                  const license = firstOf<any>(organization.licenses);
                  const isActive = license?.is_active === true;
                  const licenseStatus = getLicenseStatus(i18n, license?.expires_at);
                  const points: any[] = organization.structures ?? [];
                  const orgAdmins: any[] = organization.orgAdmins ?? [];

                  return (
                    <div key={organization.id} className="p-6">
                      {/* En-tête */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                            <Network className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-slate-50 font-semibold text-lg truncate">{organization.name}</h3>
                            <p className="text-slate-400 text-sm truncate">{organization.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isLicenseValid(license) ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {isLicenseValid(license) ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {isLicenseValid(license) ? t('business.list.active') : t('business.list.inactive')}
                          </span>
                          <p className="text-xs text-slate-500">
                            {t('business.list.createdOn', { date: format.date(organization.created_at) })}
                          </p>
                        </div>
                      </div>

                      {/* Points & admins */}
                      <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
                        <div className="rounded-lg bg-slate-900/40 border border-slate-700 p-3">
                          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {t('business.list.points', { count: points.length, max: license?.max_points ?? 1 })}
                          </p>
                          {points.length === 0 ? (
                            <p className="text-slate-500">{t('business.list.noPoints')}</p>
                          ) : (
                            <p className="text-slate-200">
                              {points.map((p) => (p.is_active === false ? `${p.name} ${t('business.list.pointDisabled')}` : p.name)).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="rounded-lg bg-slate-900/40 border border-slate-700 p-3">
                          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            {t('business.list.orgAdmins')}
                          </p>
                          {orgAdmins.length === 0 ? (
                            <p className="text-amber-400">{t('business.list.noOrgAdmin')}</p>
                          ) : (
                            <p className="text-slate-200">{orgAdmins.map((a) => a.email).join(' · ')}</p>
                          )}
                        </div>
                      </div>

                      {/* Formulaire licence */}
                      <form
                        action={async (formData) => {
                          'use server';
                          const { updateOrganizationLicense } = await import('@/app/actions/structures');
                          await updateOrganizationLicense(organization.id, { success: false, error: '' }, formData);
                        }}
                        className="grid md:grid-cols-5 gap-4 mb-4"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {t('business.list.licenseStatus')}
                          </label>
                          <select
                            name="isActive"
                            defaultValue={String(isActive)}
                            className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm cursor-pointer"
                          >
                            <option value="true">{t('business.list.licenseActive')}</option>
                            <option value="false">{t('business.list.licenseDisabled')}</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {t('business.list.licenseExpiry')}
                          </label>
                          <input
                            type="datetime-local"
                            name="expiresAt"
                            defaultValue={toLocalDateTimeInput(license?.expires_at)}
                            className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {t('business.list.maxPoints')}
                          </label>
                          <input
                            type="number"
                            name="maxPoints"
                            min={1}
                            defaultValue={license?.max_points ?? 1}
                            className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400" title={t('api.keys.quotaHint')}>
                            {t('api.keys.quotaLabel')}
                          </label>
                          <input
                            type="number"
                            name="apiMonthlyOrders"
                            min={0}
                            placeholder={t('api.keys.quotaHint')}
                            defaultValue={license && 'api_monthly_orders' in license ? (license.api_monthly_orders ?? '') : 500}
                            className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="flex items-end">
                          <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                            {t('business.list.update')}
                          </Button>
                        </div>
                      </form>

                      {license?.expires_at && (
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${licenseStatus.bg} ${licenseStatus.color} mb-4`}>
                          <Calendar className="w-3 h-3" />
                          {licenseStatus.label}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                        <Link href={`/structures/${organization.id}/edit`}>
                          <Button variant="outline" size="sm" className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white">
                            <Edit2 className="w-4 h-4 mr-2" />
                            {t('common.edit')}
                          </Button>
                        </Link>

                        <form action={async () => {
                          'use server';
                          const { deleteOrganization } = await import('@/app/actions/structures');
                          await deleteOrganization(organization.id);
                        }}>
                          <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            className="bg-red-900/40 text-red-400 hover:bg-red-900/60 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('common.delete')}
                          </Button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            {t('business.list.deleteWarning')}
          </p>
        </div>
      </div>
    </div>
  );
}
