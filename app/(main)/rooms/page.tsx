import { getRooms } from '@/app/actions/rooms';
import { requireAuth } from '@/app/actions/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BedDouble, Plus } from 'lucide-react';
import RoomsList from '@/components/rooms-list';

import { requireRole } from '@/app/actions/auth';

export default async function RoomsPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN', 'RECEPTION');
  const rooms = await getRooms();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Chambres</h1>
          <p className="text-slate-400">Gérez vos chambres d'hôtel</p>
        </div>
        <Link href="/rooms/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Chambre
          </Button>
        </Link>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">Toutes les chambres ({rooms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="text-slate-400 py-8 text-center border border-dashed border-slate-700 rounded-lg">
              Aucune chambre de configurée.
            </div>
          ) : (
            <RoomsList rooms={rooms} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
