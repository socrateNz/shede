import Link from 'next/link';
import { ArrowLeft, MapPinned, Power } from 'lucide-react';
import { requireRole } from '@/app/actions/auth';
import {
  createDeliveryZone,
  listDeliveryZones,
  setDeliveryZoneActive,
  updateDeliveryZone,
} from '@/app/actions/delivery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoneForm } from '@/components/delivery/zone-form';
import { getT } from '@/lib/i18n/server';

export default async function DeliveryZonesPage() {
  await requireRole('ADMIN', 'MANAGER');
  const { t } = await getT();
  const zones = await listDeliveryZones();

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full space-y-6">
        <Link href="/delivery" className="inline-flex items-center gap-2 text-slate-400 transition-colors hover:text-blue-400">
          <ArrowLeft className="h-4 w-4" />
          {t('delivery.zones.back')}
        </Link>

        <div>
          <h1 className="text-3xl font-bold text-white">{t('delivery.zones.title')}</h1>
          <p className="mt-1 text-slate-400">
            {t('delivery.zones.subtitle')}
          </p>
        </div>

        <Card className="border-slate-700/50 bg-slate-800/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-slate-50">
              <MapPinned className="h-5 w-5 text-cyan-400" />
              {t('delivery.zones.newZone')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ZoneForm action={createDeliveryZone} />
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-slate-800/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50">{t('delivery.zones.list', { count: zones.length })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {zones.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">
                {t('delivery.zones.empty')}
              </p>
            ) : (
              <ul className="divide-y divide-slate-700/60">
                {zones.map((zone) => (
                  <li key={zone.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                    <div className="flex-1">
                      <ZoneForm action={updateDeliveryZone.bind(null, zone.id)} zone={zone} />
                    </div>
                    <form
                      action={async () => {
                        'use server';
                        await setDeliveryZoneActive(zone.id, !zone.is_active);
                      }}
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className={
                          zone.is_active
                            ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                            : 'border-emerald-900/60 text-emerald-400 hover:bg-emerald-900/30'
                        }
                      >
                        <Power className="mr-1.5 h-4 w-4" />
                        {zone.is_active ? t('common.disable') : t('common.reactivate')}
                      </Button>
                    </form>
                    {!zone.is_active && <span className="text-xs text-slate-500">{t('delivery.zones.hidden')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
