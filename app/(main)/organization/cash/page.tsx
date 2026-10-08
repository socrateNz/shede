import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, CheckCircle, Receipt, Wallet } from 'lucide-react';
import { requireRole } from '@/app/actions/auth';
import { getOwnerShifts } from '@/app/actions/owner';
import { ShiftsHistoryTable } from '@/components/shifts-history-table';
import { PointSelect } from '@/components/owner/point-select';
import { cn } from '@/lib/utils';
import { getT } from '@/lib/i18n/server';

const STATUS_OPTIONS = [
  { value: '', key: 'org.cash.statusAll' },
  { value: 'OPEN', key: 'org.cash.statusOpen' },
  { value: 'CLOSED', key: 'org.cash.statusClosed' },
] as const;

function buildHref(params: { point?: string | null; status?: string | null }) {
  const search = new URLSearchParams();
  if (params.point) search.set('point', params.point);
  if (params.status) search.set('status', params.status);
  const query = search.toString();
  return query ? `/organization/cash?${query}` : '/organization/cash';
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-blue-500 bg-blue-600 text-white'
          : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
      )}
    >
      {children}
    </Link>
  );
}

export default async function OwnerCashPage({
  searchParams,
}: {
  searchParams: Promise<{ point?: string; status?: string }>;
}) {
  await requireRole('ORG_ADMIN');
  const { t, format } = await getT();
  const params = await searchParams;
  const data = await getOwnerShifts({ pointId: params.point, status: params.status });
  if (!data) redirect('/login');

  const closed = data.shifts.filter((s) => s.status === 'CLOSED');
  const totalDifference = closed.reduce((sum, s) => sum + (Number(s.difference) || 0), 0);
  const negativeCount = closed.filter((s) => Number(s.difference) < 0).length;
  const openCount = data.shifts.filter((s) => s.status === 'OPEN').length;

  const summary = [
    { label: t('org.cash.sessions'), value: String(data.shifts.length), icon: Receipt, tone: 'text-slate-50' },
    { label: t('org.cash.openNow'), value: String(openCount), icon: CheckCircle, tone: 'text-slate-50' },
    {
      label: t('org.cash.shortSessions'),
      value: String(negativeCount),
      icon: AlertTriangle,
      tone: negativeCount > 0 ? 'text-red-400' : 'text-slate-50',
    },
    {
      label: t('org.cash.totalGap'),
      value: `${totalDifference > 0 ? '+' : ''}${format.money(totalDifference)}`,
      icon: Wallet,
      tone: totalDifference < 0 ? 'text-red-400' : 'text-slate-50',
    },
  ];

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">{t('org.cash.title')}</h1>
          <p className="mt-1 text-slate-400">
            {t('org.cash.subtitle')}
          </p>
        </div>

        {/* Filtres */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2" aria-label={t('org.cash.statusAria')}>
            {STATUS_OPTIONS.map((s) => (
              <FilterChip
                key={s.value || 'all'}
                href={buildHref({ point: data.pointId, status: s.value })}
                active={(data.status ?? '') === s.value}
              >
                {t(s.key)}
              </FilterChip>
            ))}
          </div>
          <PointSelect points={data.points} value={data.pointId} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              <p className={cn('text-2xl font-bold', item.tone)}>{item.value}</p>
            </div>
          ))}
        </div>

        <ShiftsHistoryTable shifts={data.shifts} showPoint={data.points.length > 1 && !data.pointId} />
      </div>
    </div>
  );
}
