import { requireRole } from '@/app/actions/auth';
import { getClients } from '@/app/actions/clients';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { ClientsList } from '@/components/clients-list';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('crm.meta.listTitle'), description: t('crm.meta.listDescription') };
}

export default async function ClientsPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CAISSE');
  const { t } = await getT();
  const clients = await getClients();

  const totalClients = clients.length;
  // Clients créés ce mois-ci
  const now = new Date();
  const newClientsThisMonth = clients.filter(c => {
    const created = new Date(c.created_at);
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              {t('crm.list.title')}
            </h1>
            <p className="text-slate-400">{t('crm.list.subtitle')}</p>
          </div>
          <Button asChild className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <Link href="/clients/new">
              <Plus className="w-4 h-4 mr-2" />
              {t('crm.list.newClient')}
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{totalClients}</div>
                <div className="text-sm text-slate-400">{t('crm.list.statTotal')}</div>
              </div>
              <div className="p-3 bg-pink-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-pink-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-rose-400">+{newClientsThisMonth}</div>
                <div className="text-sm text-slate-400">{t('crm.list.statNew')}</div>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-6 h-6 text-rose-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Liste */}
        <ClientsList clients={clients} />
      </div>
    </div>
  );
}
