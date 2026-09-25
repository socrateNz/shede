import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, ShieldCheck, Power } from 'lucide-react';
import { requireRole } from '@/app/actions/auth';
import {
  addPointAdmin,
  getMyPoint,
  setPointActive,
  setPointAdminActive,
  updatePoint,
} from '@/app/actions/organizations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PointForm } from '@/components/organization/point-form';
import { AdminAccountForm } from '@/components/organization/admin-account-form';
import { getT } from '@/lib/i18n/server';

export default async function PointPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('ORG_ADMIN');
  const { t } = await getT();
  const { id } = await params;
  const point = await getMyPoint(id);
  if (!point) notFound();

  const isActive = point.is_active !== false;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full space-y-8">
        <Link
          href="/organization/points"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('org.newPoint.back')}</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{point.name}</h1>
            <p className={isActive ? 'text-green-400' : 'text-red-400'}>
              {isActive ? t('org.pointDetail.active') : t('org.pointDetail.disabled')}
            </p>
          </div>
          <form
            action={async () => {
              'use server';
              await setPointActive(point.id, !isActive);
            }}
          >
            <Button
              type="submit"
              variant="outline"
              className={
                isActive
                  ? 'border-red-900/60 text-red-400 hover:bg-red-900/30 hover:text-red-300'
                  : 'border-green-900/60 text-green-400 hover:bg-green-900/30 hover:text-green-300'
              }
            >
              <Power className="w-4 h-4 mr-2" />
              {isActive ? t('org.pointDetail.disable') : t('org.pointDetail.reactivate')}
            </Button>
          </form>
        </div>

        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-xl text-white flex items-center gap-3">
              <Building2 className="w-5 h-5 text-blue-400" />
              {t('org.pointDetail.infoTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <PointForm
              action={updatePoint.bind(null, point.id)}
              defaultValues={point}
              submitLabel={t('common.save')}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-xl text-white flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              {t('org.pointDetail.adminsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {point.admins.length === 0 ? (
              <p className="text-sm text-amber-400">
                {t('org.pointDetail.noAdmins')}
              </p>
            ) : (
              <ul className="divide-y divide-slate-700 rounded-lg border border-slate-700">
                {point.admins.map((user: any) => (
                  <li key={user.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-slate-50 font-medium truncate">
                        {`${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email}
                      </p>
                      <p className="text-sm text-slate-400 truncate">{user.email}</p>
                    </div>
                    <form
                      action={async () => {
                        'use server';
                        await setPointAdminActive(point.id, user.id, !user.is_active);
                      }}
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        {user.is_active ? t('common.disable') : t('common.reactivate')}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <div className="pt-2">
              <p className="text-sm font-medium text-slate-300 mb-3">{t('org.pointDetail.addAdmin')}</p>
              <AdminAccountForm
                action={addPointAdmin.bind(null, point.id)}
                submitLabel={t('org.pointDetail.addAdminSubmit')}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
