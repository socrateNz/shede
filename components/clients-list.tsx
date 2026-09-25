'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Edit, Trash2, Calendar, Phone, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';

export function ClientsList({ clients }: { clients: any[] }) {
  const [search, setSearch] = useState('');
  const { t, format } = useT();

  const filteredClients = clients.filter(client => {
    const term = search.toLowerCase();
    const fullName = `${client.first_name} ${client.last_name}`.toLowerCase();
    return fullName.includes(term) || (client.phone && client.phone.includes(term)) || (client.email && client.email.toLowerCase().includes(term));
  });

  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50">
      <CardHeader className="border-b border-slate-700/50 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-xl font-bold text-white">{t('crm.list.listTitle')}</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('crm.list.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-4 font-medium">{t('crm.list.colClient')}</th>
                <th className="px-6 py-4 font-medium">{t('crm.list.colContact')}</th>
                <th className="px-6 py-4 font-medium">{t('crm.list.colBirthday')}</th>
                <th className="px-6 py-4 font-medium text-right">{t('crm.list.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <User className="w-12 h-12 mb-3 text-slate-600" />
                      <p className="text-lg font-medium text-slate-400">{t('crm.list.emptyTitle')}</p>
                      <p className="text-sm">{t('crm.list.emptyText')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-700/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30 flex items-center justify-center shrink-0">
                          <span className="text-pink-400 font-bold uppercase">
                            {client.first_name[0]}{client.last_name[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">
                            {client.first_name} {client.last_name}
                          </div>
                          {client.preferences && (
                            <div className="text-xs text-slate-500 truncate max-w-[200px]" title={client.preferences}>
                              {client.preferences}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {client.phone ? (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            {client.phone}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs italic">{t('crm.list.noPhone')}</span>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-2 text-slate-400 text-xs">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            {client.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {client.birthday ? (
                        <div className="flex items-center gap-2 text-slate-300">
                          <Calendar className="w-4 h-4 text-pink-400" />
                          {format.date(client.birthday)}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <Button asChild variant="outline" size="sm" className="bg-slate-900/50 border-slate-600 hover:bg-slate-700 text-slate-300 hover:text-white">
                          <Link href={`/clients/${client.id}`}>
                            {t('crm.list.details')}
                          </Link>
                        </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
