import { getRooms } from '@/app/actions/rooms';
import { requireAuth } from '@/app/actions/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BedDouble, Plus, Hotel, CheckCircle, XCircle } from 'lucide-react';
import RoomsList from '@/components/rooms-list';
import { requireRole } from '@/app/actions/auth';
import { getT } from '@/lib/i18n/server';

async function getRoomsStats(rooms: any[]) {
  const total = rooms.length;
  const available = rooms.filter(room => room.status === 'AVAILABLE').length;
  const occupied = rooms.filter(room => room.status === 'OCCUPIED').length;
  const cleaning = rooms.filter(room => room.status === 'CLEANING').length;

  return { total, available, occupied, cleaning };
}

export default async function RoomsPage() {
  await requireRole('ADMIN', 'RECEPTION');
  const { t } = await getT();
  const rooms = await getRooms();
  const stats = await getRoomsStats(rooms);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              {t('hotel.rooms.title')}
            </h1>
            <p className="text-slate-400">{t('hotel.rooms.subtitle')}</p>
          </div>
          <Link href="/rooms/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <Plus className="w-4 h-4 mr-2" />
              {t('hotel.rooms.newRoom')}
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-slate-400">{t('hotel.rooms.statTotal')}</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Hotel className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.available}</div>
                <div className="text-sm text-slate-400">{t('hotel.rooms.statAvailable')}</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-400">{stats.occupied}</div>
                <div className="text-sm text-slate-400">{t('hotel.rooms.statOccupied')}</div>
              </div>
              <div className="p-3 bg-red-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-400">{stats.cleaning}</div>
                <div className="text-sm text-slate-400">{t('hotel.rooms.statCleaning')}</div>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
              </div>
            </div>
          </div>
        </div>

        {/* Rooms List Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-blue-400" />
              {t('hotel.rooms.allRooms', { count: rooms.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rooms.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <Hotel className="w-10 h-10 opacity-30" />
                </div>
                <p className="text-lg">{t('hotel.rooms.emptyTitle')}</p>
                <p className="text-sm mt-2 mb-6">{t('hotel.rooms.emptyText')}</p>
                <Link href="/rooms/new">
                  <Button variant="outline" className="border-slate-600 text-blue-400 hover:bg-slate-700 hover:text-blue-300">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('hotel.rooms.addRoom')}
                  </Button>
                </Link>
              </div>
            ) : (
              <RoomsList rooms={rooms} />
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            {t('hotel.rooms.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}