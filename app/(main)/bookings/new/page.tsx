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
import { useT } from '@/lib/i18n/client';

const ROOM_TYPES = ['Standard', 'Double', 'Studio', 'Suite', 'Familiale', 'Autre'] as const;

export default function NewBookingPage() {
  const router = useRouter();
  const { t } = useT();
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
        {t('hotel.bookingForm.back')}
      </Link>

      <Card className="bg-slate-800 border-slate-700 w-full">
        <CardHeader>
          <CardTitle className="text-slate-50">{t('hotel.bookingForm.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">{t('hotel.bookingForm.room')}</label>
              <select
                name="roomId"
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded-md px-3 py-2"
                required
              >
                 <option value="">{t('hotel.bookingForm.selectRoom')}</option>
                 {rooms.map(room => (
                   <option key={room.id} value={room.id}>
                     {room.number} - {ROOM_TYPES.includes(room.type) ? t(`hotel.roomTypes.${room.type as (typeof ROOM_TYPES)[number]}.label`) : room.type}
                   </option>
                 ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">{t('hotel.bookingForm.clientName')}</label>
                <Input
                  type="text"
                  name="clientName"
                  placeholder={t('hotel.bookingForm.clientNamePlaceholder')}
                  className="bg-slate-700 border-slate-600 text-slate-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">{t('hotel.bookingForm.phone')}</label>
                <Input
                  type="tel"
                  name="phone"
                  placeholder={t('hotel.bookingForm.phonePlaceholder')}
                  className="bg-slate-700 border-slate-600 text-slate-50"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">{t('hotel.bookingForm.checkIn')}</label>
                <Input
                  type="date"
                  name="checkIn"
                  className="bg-slate-700 border-slate-600 text-slate-50"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">{t('hotel.bookingForm.checkOut')}</label>
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
                {isPending ? t('hotel.bookingForm.saving') : t('hotel.bookingForm.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
