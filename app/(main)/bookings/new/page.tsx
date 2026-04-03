'use client';

import { createBooking } from '@/app/actions/bookings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getRooms } from '@/app/actions/rooms';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

export default function NewBookingPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const structure = useAppStore(s => s.activeStructure);

  const [state, formAction, isPending] = useActionState(createBooking, {
    success: false,
    error: '',
  });

  useEffect(() => {
    if (state.success) {
      router.push('/bookings');
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state.success, state.error, router]);

  useEffect(() => {
    getRooms().then(res => setRooms(res.filter(r => r.status === 'AVAILABLE')));
  }, []);

  return (
    <div className="p-8">
      <Link href="/bookings" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Bookings
      </Link>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Create Reservation</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Room *</label>
              <select
                name="roomId"
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded-md px-3 py-2"
                required
              >
                 <option value="">Select an available room</option>
                 {rooms.map(room => (
                   <option key={room.id} value={room.id}>
                     {room.number} - {room.type}
                   </option>
                 ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Client Name</label>
                <Input
                  type="text"
                  name="clientName"
                  placeholder="Walk-in Client (Optional)"
                  className="bg-slate-700 border-slate-600 text-slate-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Phone *</label>
                <Input
                  type="tel"
                  name="phone"
                  placeholder="Client Phone"
                  className="bg-slate-700 border-slate-600 text-slate-50"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Check In Date *</label>
                <Input
                  type="date"
                  name="checkIn"
                  className="bg-slate-700 border-slate-600 text-slate-50"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Check Out Date *</label>
                <Input
                  type="date"
                  name="checkOut"
                  className="bg-slate-700 border-slate-600 text-slate-50"
                  required
                />
              </div>
            </div>

            {state.error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {state.error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? 'Saving...' : 'Book Room'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
