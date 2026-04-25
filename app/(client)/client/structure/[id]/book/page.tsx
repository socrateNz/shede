'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, BedDouble, Users, Phone, CheckCircle, Sparkles, Clock, Coffee, Wifi, Tv, Wind, Shield } from 'lucide-react';
import Link from 'next/link';
import { createClientBooking } from '@/app/actions/client-bookings';
import { formatFCFA } from '@/lib/utils';

interface Room {
  id: string;
  number: string;
  type: string;
  status: string;
  price: number;
  capacity?: number;
  description?: string;
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
  const [guestCount, setGuestCount] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');

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

  const selectedRoomData = rooms.find(r => r.id === selectedRoom);

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();
  const totalPrice = selectedRoomData && nights > 0 ? selectedRoomData.price * nights : 0;

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
        router.push(`/client/structure/${structureId}`);
      }, 3000);
    } else {
      setErrorStr(res.error || 'Une erreur est survenue');
    }
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur-2xl opacity-30 animate-pulse" />
            <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 rounded-full p-6">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Réservation Confirmée !</h2>
          <p className="text-slate-600 mb-4">
            Votre réservation a bien été envoyée à la réception.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">Chambre :</span> {selectedRoomData?.number} - {selectedRoomData?.type}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-semibold">Dates :</span> {new Date(checkIn).toLocaleDateString('fr-FR')} → {new Date(checkOut).toLocaleDateString('fr-FR')}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-semibold">Total :</span> {formatFCFA(totalPrice)}
            </p>
          </div>
          <div className="animate-pulse">
            <p className="text-sm text-slate-400">Redirection...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">

        <Link
          href={`/client/structure/${structureId}`}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-medium">Retour</span>
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-xl overflow-hidden">
              <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 p-6 text-white overflow-hidden">
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                <div className="relative flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                    <BedDouble className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">Réserver votre séjour</h1>
                    <p className="text-blue-100 text-sm mt-0.5">Sélectionnez vos dates et votre chambre</p>
                  </div>
                </div>
              </div>

              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <BedDouble className="w-4 h-4 text-blue-600" />
                      Chambres disponibles
                    </label>

                    {loading ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                      </div>
                    ) : rooms.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                        <p className="text-amber-700 text-sm">Aucune chambre disponible.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {rooms.map(room => (
                          <div
                            key={room.id}
                            onClick={() => setSelectedRoom(room.id)}
                            className={`cursor-pointer rounded-xl p-4 transition-all duration-300 ${selectedRoom === room.id
                              ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-500 shadow-md'
                              : 'bg-white border-2 border-slate-200 hover:border-blue-300 hover:shadow-sm'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-lg font-bold ${selectedRoom === room.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                Ch. {room.number}
                              </span>
                              {selectedRoom === room.id && (
                                <CheckCircle className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mb-2">{room.type}</p>
                            <p className="text-sm font-bold text-blue-600">{formatFCFA(room.price)}<span className="text-xs font-normal text-slate-500"> /nuit</span></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        Nom complet
                      </label>
                      <Input
                        type="text"
                        placeholder="Jean Dupont"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        required
                        className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-blue-600" />
                        Téléphone
                      </label>
                      <Input
                        type="tel"
                        placeholder="06 12 34 56 78"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        required
                        className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        Arrivée
                      </label>
                      <Input
                        type="date"
                        value={checkIn}
                        onChange={e => setCheckIn(e.target.value)}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        Départ
                      </label>
                      <Input
                        type="date"
                        value={checkOut}
                        onChange={e => setCheckOut(e.target.value)}
                        required
                        min={checkIn || new Date().toISOString().split('T')[0]}
                        className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  {errorStr && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-red-600 text-sm">{errorStr}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || !selectedRoom || rooms.length === 0 || !guestName || !phone || !checkIn || !checkOut}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold h-12 text-lg rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        Traitement...
                      </div>
                    ) : (
                      `Confirmer`
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {selectedRoomData && nights > 0 && (
                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Récapitulatif
                    </h3>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <p className="text-sm text-slate-500">Chambre</p>
                      <p className="font-bold text-slate-800 text-lg">{selectedRoomData.number} - {selectedRoomData.type}</p>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Prix / nuit</span>
                        <span>{formatFCFA(selectedRoomData.price)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">{nights} nuit {nights > 1 ? 's' : ''}</span>
                        <span>{nights > 1 ? formatFCFA(selectedRoomData.price * nights) : formatFCFA(selectedRoomData.price)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-200 mt-2">
                        <span>Total</span>
                        <span className="text-emerald-600">{formatFCFA(totalPrice)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* <Card className="border-0 shadow-lg">
                <CardContent className="p-5 space-y-3">
                  <h4 className="font-semibold text-slate-700 mb-2">À savoir</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>Check-in: 14h • Check-out: 12h</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Wifi className="w-4 h-4 text-blue-500" />
                      <span>Wi-Fi gratuit</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span>Annulation gratuite</span>
                    </div>
                  </div>
                </CardContent>
              </Card> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}