import { requireRole } from '@/app/actions/auth';
import { getBookings, updateBookingStatus } from '@/app/actions/bookings';
import { getSession } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, CalendarDays } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  CONFIRMED: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  IN_PROGRESS: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  COMPLETED: { bg: 'bg-green-500/10', text: 'text-green-400' },
  CANCELLED: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

export default async function BookingsPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'RECEPTION');
  
  if (!session?.structureId) return null;
  const bookings = await getBookings(session.structureId);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Bookings</h1>
          <p className="text-slate-400">Manage hotel reservations</p>
        </div>
        <Link href="/bookings/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Booking
          </Button>
        </Link>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">Reservation List</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No bookings found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-800">
                  <TableHead className="text-slate-300">Room</TableHead>
                  <TableHead className="text-slate-300">Client</TableHead>
                  <TableHead className="text-slate-300">Check In</TableHead>
                  <TableHead className="text-slate-300">Check Out</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking: any) => (
                  <TableRow key={booking.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="font-medium text-slate-200">
                      {booking.rooms?.number} ({booking.rooms?.type})
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {booking.users ? `${booking.users.first_name} ${booking.users.last_name}` : 'Walk-in / Unknown'}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(booking.check_in).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(booking.check_out).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[booking.status]?.bg} ${statusColors[booking.status]?.text}`}>
                        {booking.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={async () => {
                         'use server';
                         // Rotate to next status
                         let nextStatus = 'CONFIRMED';
                         if (booking.status === 'CONFIRMED') nextStatus = 'IN_PROGRESS';
                         else if (booking.status === 'IN_PROGRESS') nextStatus = 'COMPLETED';
                         await updateBookingStatus(booking.id, nextStatus, booking.room_id);
                      }}>
                        {['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(booking.status) && (
                          <Button size="sm" variant="outline" className="text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                            Adv. Status
                          </Button>
                        )}
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
