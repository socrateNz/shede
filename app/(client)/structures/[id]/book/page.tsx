'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, BedDouble } from 'lucide-react';
import Link from 'next/link';
import { createClientBooking } from '@/app/actions/client-bookings';
import { formatFCFA } from '@/lib/utils';

interface Room {
  id: string;
  number: string;
  type: string;
  status: string;
  price: number
}

export default function ClientBookRoomPage() {
  const params = useParams();
  const router = useRouter();
  const structureId = params.id as string;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorStr, setErrorStr] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchRooms() {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('structure_id', structureId)
        .order('number', { ascending: true });

      if (data) setRooms(data);
      setLoading(false);
    }
    fetchRooms();
  }, [structureId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !checkIn || !checkOut || !guestName || !phone) return;

    setIsSubmitting(true);
    setErrorStr('');

    const res = await createClientBooking(structureId, selectedRoom, checkIn, checkOut, guestName, phone);
    setIsSubmitting(false);

    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push(`/structures/${structureId}`);
      }, 3000);
    } else {
      setErrorStr(res.error || 'An error occurred');
    }
  };

  if (success) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-20 text-center">
        <div className="bg-green-100 text-green-800 p-8 rounded-2xl">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-green-600" />
          <h2 className="text-2xl font-bold mb-2">Réservation Confirmée !</h2>
          <p>Votre réservation a bien été envoyée à la réception.</p>
          <p className="text-sm mt-4 opacity-75">Redirection vers l'accueil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <Link href={`/structures/${structureId}`} className="inline-flex items-center text-blue-600 hover:underline mb-6 font-medium">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à l'établissement
      </Link>

      <Card className="bg-white shadow-xl border-0 overflow-hidden">
        <div className="bg-blue-600 p-6 text-white text-center">
          <BedDouble className="w-12 h-12 mx-auto mb-2 opacity-90" />
          <CardTitle className="text-2xl">Réserver votre séjour</CardTitle>
          <p className="opacity-80 mt-1">Sélectionnez vos dates et votre chambre</p>
        </div>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Chambres Disponibles</label>
              {loading ? (
                <div className="p-3 bg-slate-50 text-slate-500 rounded-md">Chargement des chambres...</div>
              ) : rooms.length === 0 ? (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">Aucune chambre disponible actuellement.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {rooms.map(room => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room.id)}
                      className={`cursor-pointer border-2 rounded-xl p-4 text-center transition-all ${selectedRoom === room.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-blue-300'}`}
                    >
                      <div className="font-bold text-lg">{room.number}</div>
                      <div className="text-xs opacity-75">{room.type}</div>
                      <div className="text-md font-semibold opacity-75">{formatFCFA(room.price)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Nom & Prénom</label>
                <Input type="text" placeholder="Votre nom complet" value={guestName} onChange={e => setGuestName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Téléphone</label>
                <Input type="tel" placeholder="Votre numéro" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Date d'arrivée</label>
                <Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Date de départ</label>
                <Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} required min={checkIn || new Date().toISOString().split('T')[0]} />
              </div>
            </div>

            {errorStr && <p className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded-md">{errorStr}</p>}

            <Button
              type="submit"
              disabled={isSubmitting || !selectedRoom || rooms.length === 0 || !guestName || !phone}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-lg rounded-xl"
            >
              {isSubmitting ? 'Traitement...' : 'Confirmer la Réservation'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
