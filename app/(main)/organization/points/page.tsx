import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/app/actions/auth';
import { getMyOrganizationOverview, setPointActive } from '@/app/actions/organizations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { moduleLabel } from '@/lib/modules';
import { getT } from '@/lib/i18n/server';
import type { TranslationKey } from '@/lib/i18n/translate';
import {
  Plus,
  Building2,
  MapPin,
  Users,
  ShieldCheck,
  Calendar,
  CheckCircle,
  XCircle,
  Settings2,
  Power,
} from 'lucide-react';


export default async function OrganizationPointsPage() {
  await requireRole('ORG_ADMIN');
  const { t, format } = await getT();
  const overview = await getMyOrganizationOverview();
  if (!overview) redirect('/login');

  const { organization, license, points } = overview;
  const maxPoints = license?.max_points ?? 1;
  const canCreatePoint = Boolean(license?.isValid) && points.length < maxPoints;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">{organization.name}</h1>
            <p className="text-slate-400">
              {t('org.points.subtitle')}
            </p>
          </div>
          {canCreatePoint ? (
            <Link href="/organization/points/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                {t('org.points.newPoint')}
              </Button>
            </Link>
          ) : (
            <p className="text-sm text-amber-300 max-w-xs sm:text-right">
              {license?.isValid
                ? t('org.points.limitReached', { max: maxPoints })
                : t('org.points.licenseInvalid')}
            </p>
          )}
        </div>

        {/* Licence */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              {t('org.points.licenseTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400">{t('org.points.status')}</p>
                <p className={`font-semibold flex items-center gap-1.5 ${license?.isValid ? 'text-green-400' : 'text-red-400'}`}>
                  {license?.isValid ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {license?.isValid ? t('org.points.active') : t('org.points.inactive')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('org.points.plan')}</p>
                <p className="font-semibold text-slate-50">{license?.plan ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('org.points.expiry')}</p>
                <p className="font-semibold text-slate-50 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {license?.expires_at
                    ? format.date(license.expires_at)
                    : t('org.points.unlimited')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('org.points.pointsUsed')}</p>
                <p className="font-semibold text-slate-50">
                  {points.length} / {maxPoints}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">
                {t('org.points.modulesIncluded')}
              </p>
              <div className="flex flex-wrap gap-2">
                {organization.modules.map((module) => (
                  <span
                    key={module}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20"
                  >
                    {moduleLabel(t, module)}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Points */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              {t('org.points.listTitle', { count: points.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {points.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Building2 className="w-10 h-10 mx-auto mb-4 opacity-30" />
                <p className="text-lg">{t('org.points.emptyTitle')}</p>
                <p className="text-sm mt-2">
                  {t('org.points.emptyText')}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-700">
                {points.map((point) => {
                  const isActive = point.is_active !== false;
                  return (
                    <li key={point.id} className="p-6 flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-slate-50 font-semibold text-lg truncate">{point.name}</h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {isActive ? t('org.points.pointActive') : t('org.points.pointDisabled')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>{t(`org.pointTypes.${point.type}` as TranslationKey)}</span>
                          {point.city && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {point.city}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {t('org.points.accounts', { count: point.staffCount })}
                          </span>
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          {t('org.points.adminLabel')}{' '}
                          {point.admins.length > 0
                            ? point.admins
                                .map((a: any) => `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email)
                                .join(', ')
                            : <span className="text-amber-400">{t('org.points.noAdmin')}</span>}
                        </p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Link href={`/organization/points/${point.id}`}>
                          <Button variant="outline" size="sm" className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white">
                            <Settings2 className="w-4 h-4 mr-2" />
                            {t('common.manage')}
                          </Button>
                        </Link>
                        <form
                          action={async () => {
                            'use server';
                            await setPointActive(point.id, !isActive);
                          }}
                        >
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className={
                              isActive
                                ? 'border-red-900/60 text-red-400 hover:bg-red-900/30 hover:text-red-300'
                                : 'border-green-900/60 text-green-400 hover:bg-green-900/30 hover:text-green-300'
                            }
                          >
                            <Power className="w-4 h-4 mr-2" />
                            {isActive ? t('common.disable') : t('common.enable')}
                          </Button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
