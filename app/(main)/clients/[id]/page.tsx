import { requireRole } from '@/app/actions/auth';
import { getClientById } from '@/app/actions/clients';
import { getAdminSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, User, Phone, Mail, Calendar, Heart, MessageSquare, ShoppingBag, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import type { TranslationKey } from '@/lib/i18n/translate';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('crm.meta.detailTitle'), description: t('crm.meta.detailDescription') };
}

async function getClientHistory(clientId: string, structureId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('orders')
    .select('id, created_at, status, total, source')
    .eq('client_id', clientId)
    .eq('structure_id', structureId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching client history:', error);
    return [];
  }
  return data || [];
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CAISSE');
  const { id } = await params;
  const { t, format } = await getT();

  const client = await getClientById(id);
  if (!client) {
    notFound();
  }

  const history = await getClientHistory(id, session.structureId!);

  const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    READY: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    SERVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  const SOURCES = ['CLIENT', 'QR_CODE', 'CAISSE'];

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-pink-400 transition-all duration-300 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>{t('crm.detail.back')}</span>
          </Link>
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
            {t('crm.detail.editSoon')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne de gauche : Infos Client */}
          <div className="space-y-6">
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
              <CardContent className="pt-6 text-center">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30 flex items-center justify-center mb-4 shadow-lg shadow-pink-500/10">
                  <span className="text-3xl font-bold text-pink-400 uppercase">
                    {client.first_name[0]}{client.last_name[0]}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {client.first_name} {client.last_name}
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                  {t('crm.detail.since', { date: format.date(client.created_at) })}
                </p>

                <div className="space-y-4 text-left border-t border-slate-700/50 pt-4">
                  {client.phone && (
                    <div className="flex items-center gap-3 text-slate-300">
                      <div className="p-2 bg-slate-900/50 rounded-lg">
                        <Phone className="w-4 h-4 text-pink-400" />
                      </div>
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-3 text-slate-300">
                      <div className="p-2 bg-slate-900/50 rounded-lg">
                        <Mail className="w-4 h-4 text-pink-400" />
                      </div>
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.birthday && (
                    <div className="flex items-center gap-3 text-slate-300">
                      <div className="p-2 bg-slate-900/50 rounded-lg">
                        <Calendar className="w-4 h-4 text-pink-400" />
                      </div>
                      <span>{format.date(client.birthday)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
              <CardHeader className="border-b border-slate-700/50 pb-4">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-400" />
                  {t('crm.detail.preferences')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {client.allergies ? (
                  <div>
                    <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1">{t('crm.detail.allergies')}</h4>
                    <p className="text-sm text-slate-300 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                      {client.allergies}
                    </p>
                  </div>
                ) : null}
                {client.preferences ? (
                  <div>
                    <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">{t('crm.detail.preferencesLabel')}</h4>
                    <p className="text-sm text-slate-300 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg">
                      {client.preferences}
                    </p>
                  </div>
                ) : null}
                {!client.allergies && !client.preferences && (
                  <p className="text-sm text-slate-500 text-center italic py-2">
                    {t('crm.detail.noPreferences')}
                  </p>
                )}
              </CardContent>
            </Card>

            {client.notes && (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
                <CardHeader className="border-b border-slate-700/50 pb-4">
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-400" />
                    {t('crm.detail.notes')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-slate-300 bg-slate-900/50 border border-slate-700/50 p-3 rounded-lg whitespace-pre-wrap">
                    {client.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Colonne de droite : Historique */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 h-full">
              <CardHeader className="border-b border-slate-700/50 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-pink-400" />
                    {t('crm.detail.history')}
                  </CardTitle>
                  <Badge variant="outline" className="bg-pink-500/10 text-pink-400 border-pink-500/30">
                    {t('crm.detail.orderCount', { count: history.length })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700/50">
                      <tr>
                        <th className="px-6 py-4 font-medium">{t('crm.detail.colDate')}</th>
                        <th className="px-6 py-4 font-medium">{t('crm.detail.colOrder')}</th>
                        <th className="px-6 py-4 font-medium">{t('crm.detail.colAmount')}</th>
                        <th className="px-6 py-4 font-medium">{t('crm.detail.colSource')}</th>
                        <th className="px-6 py-4 font-medium text-right">{t('crm.detail.colStatus')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-500">
                              <ShoppingBag className="w-12 h-12 mb-3 text-slate-600" />
                              <p className="text-lg font-medium text-slate-400">{t('crm.detail.emptyTitle')}</p>
                              <p className="text-sm">{t('crm.detail.emptyText')}</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        history.map((order) => {
                          const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.PENDING;
                          return (
                            <tr key={order.id} className="hover:bg-slate-700/20 transition-colors group">
                              <td className="px-6 py-4 text-slate-300">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-slate-500" />
                                  {format.dateTime(order.created_at)}
                                </div>
                              </td>
                              <td className="px-6 py-4 font-mono text-slate-400">
                                #{order.id.slice(-8).toUpperCase()}
                              </td>
                              <td className="px-6 py-4 font-bold text-white">
                                {format.money(order.total)}
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className="bg-slate-900 border-slate-600 text-slate-300">
                                  {SOURCES.includes(order.source) ? t(`orders.source.${order.source}` as TranslationKey) : order.source}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Badge variant="outline" className={statusColor}>
                                  {order.status in STATUS_COLORS ? t(`orders.status.${order.status}` as TranslationKey) : order.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
