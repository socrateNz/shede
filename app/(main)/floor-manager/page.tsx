import { requireRole } from '@/app/actions/auth';
import { getTables, createTable } from '@/app/actions/tables';
import { getFloors } from '@/app/actions/floors';
import { getAdminSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, LayoutDashboard, QrCode } from 'lucide-react';
import Link from 'next/link';
import { FloorManagerClient } from '@/components/floor-manager-client';
import { AddTableDialog } from '@/components/add-table-dialog';
import { revalidatePath } from 'next/cache';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('floor.meta.title'), description: t('floor.meta.description') };
}

async function getActiveOrders(structureId: string) {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('orders')
    .select('id, table_number, table_id, status')
    .eq('structure_id', structureId)
    .in('status', ['PENDING', 'IN_PROGRESS', 'SERVED']);
  return data || [];
}

export default async function FloorManagerPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SERVEUR', 'CAISSE');
  const { t } = await getT();

  const tables = await getTables();
  const floors = await getFloors();
  const activeOrders = await getActiveOrders(session.structureId!);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 mb-4 backdrop-blur-sm">
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-indigo-400 font-medium">{t('floor.page.badge')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              {t('floor.page.title')}
            </h1>
            <p className="text-slate-400">{t('floor.page.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/floor-manager/qrcodes">
              <Button variant="outline" className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10">
                <QrCode className="w-4 h-4 mr-2" />
                {t('floor.page.printQr')}
              </Button>
            </Link>
            <AddTableDialog floors={floors} />
          </div>
        </div>

        {/* Client Component */}
        <FloorManagerClient initialTables={tables} activeOrders={activeOrders} floors={floors} />
      </div>
    </div>
  );
}
