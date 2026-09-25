'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, BedDouble, Users, Phone, CheckCircle, Clock, Wifi, Shield, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { createClientBooking, getRoomsForClient } from '@/app/actions/client-bookings';
import { useT } from '@/lib/i18n/client';

interface Room {
  id: string;
  number: string;
  type: string;
  status: string;
  price: number;
  capacity?: number;
  description?: string;
  images?: string[];
}

export default function ClientBookRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { t, format } = useT();
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
      const data = await getRoomsForClient(structureId);
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
      setErrorStr(res.error || t('client.booking.genericError'));
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center border border-slate-100">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-green-500 rounded-full blur-xl opacity-30 animate-pulse" />
            <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 rounded-full p-6 border border-green-100">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">{t('client.booking.confirmedTitle')}</h2>
          <p className="text-slate-500 font-medium mb-8">
            {t('client.booking.confirmedText')}
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-6 text-left space-y-4 mb-8 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <span className="text-slate-500 font-medium">{t('client.booking.room')}</span>
              <span className="font-bold text-slate-900">{t('client.booking.roomNumber', { number: selectedRoomData?.number ?? '' })} <span className="text-slate-400 font-normal">({selectedRoomData?.type})</span></span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <span className="text-slate-500 font-medium">{t('client.booking.dates')}</span>
              <span className="font-bold text-slate-900">
                {format.date(checkIn, { day: 'numeric', month: 'short' })}
                <ArrowRight className="inline w-3 h-3 mx-2 text-slate-400" /> 
                {format.date(checkOut, { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">{t('client.booking.total')}</span>
              <span className="font-black text-xl text-green-600">{format.money(totalPrice)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-blue-600 animate-pulse">
            <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            {t('client.booking.returning')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-200">
      {/* Header Premium */}
      <div className="relative bg-slate-900 text-white overflow-hidden py-12 lg:py-16">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-[100px] opacity-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-[100px] opacity-20" />
        
        <div className="relative max-w-6xl mx-auto px-4">
          <Link
            href={`/client/structure/${structureId}`}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-8 group bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md w-fit"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm">{t('client.booking.back')}</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
              <BedDouble className="w-8 h-8 text-blue-300" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2">{t('client.booking.title')}</h1>
              <p className="text-blue-100 text-lg md:text-xl font-medium">{t('client.booking.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 -mt-8 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="border border-slate-100 shadow-xl rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-6 md:p-10">
                <form onSubmit={handleSubmit} className="space-y-10">
                  
                  {/* Dates Section */}
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-6">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      {t('client.booking.datesTitle')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">{t('client.booking.checkIn')}</label>
                        <Input
                          type="date"
                          value={checkIn}
                          onChange={e => setCheckIn(e.target.value)}
                          required
                          min={new Date().toISOString().split('T')[0]}
                          className="h-14 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all rounded-xl font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">{t('client.booking.checkOut')}</label>
                        <Input
                          type="date"
                          value={checkOut}
                          onChange={e => setCheckOut(e.target.value)}
                          required
                          min={checkIn || new Date().toISOString().split('T')[0]}
                          className="h-14 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all rounded-xl font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chambres Section */}
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-6">
                      <BedDouble className="w-5 h-5 text-blue-600" />
                      {t('client.booking.chooseRoom')}
                    </h3>

                    {loading ? (
                      <div className="flex items-center justify-center p-12 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600" />
                      </div>
                    ) : rooms.length === 0 ? (
                      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-8 text-center">
                        <p className="text-orange-800 font-bold text-lg">{t('client.booking.noRooms')}</p>
                        <p className="text-orange-600/80 mt-1">{t('client.booking.noRoomsText')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {rooms.map(room => {
                          const isSelected = selectedRoom === room.id;
                          return (
                            <div
                              key={room.id}
                              onClick={() => setSelectedRoom(room.id)}
                              className={`cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 transform ${isSelected
                                ? 'bg-blue-50 border-2 border-blue-600 shadow-lg scale-[1.02]'
                                : 'bg-white border-2 border-slate-100 hover:border-blue-300 hover:shadow-md hover:-translate-y-1'
                                }`}
                            >
                              {/* Optionnel: Si la chambre a des images (selon demande), on les affichera ici */}
                              {room.images && room.images.length > 0 ? (
                                <div className="h-32 w-full bg-slate-200 relative">
                                  <img src={room.images[0]} alt={t('client.booking.roomLabel', { number: room.number })} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                    <span className="text-white font-black text-lg">{t('client.booking.roomNumber', { number: room.number })}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="h-20 w-full bg-slate-100 flex items-center px-4 relative">
                                  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-100 opacity-50" />
                                  <div className="relative z-10 flex items-center gap-2">
                                    <BedDouble className="w-5 h-5 text-slate-400" />
                                    <span className="text-slate-700 font-black text-lg">{t('client.booking.roomLabel', { number: room.number })}</span>
                                  </div>
                                </div>
                              )}
                              
                              <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">{room.type || t('client.booking.standard')}</span>
                                  {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                                      <CheckCircle className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-end justify-between">
                                  <div>
                                    <span className={`text-2xl font-black ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>{format.money(room.price)}</span>
                                    <span className="text-sm font-medium text-slate-400">{t('client.booking.perNight')}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Contact Section */}
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-6">
                      <Users className="w-5 h-5 text-blue-600" />
                      {t('client.booking.contactTitle')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">{t('client.booking.fullName')}</label>
                        <Input
                          type="text"
                          placeholder={t('client.booking.fullNamePlaceholder')}
                          value={guestName}
                          onChange={e => setGuestName(e.target.value)}
                          required
                          className="h-14 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all rounded-xl font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">{t('common.phone')}</label>
                        <Input
                          type="tel"
                          placeholder={t('client.booking.phonePlaceholder')}
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          required
                          className="h-14 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all rounded-xl font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {errorStr && (
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-4 flex items-start gap-3">
                      <div className="text-red-600 font-bold text-sm">{errorStr}</div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || !selectedRoom || rooms.length === 0 || !guestName || !phone || !checkIn || !checkOut}
                    className="w-full bg-slate-900 hover:bg-blue-600 text-white font-black h-16 text-lg rounded-2xl shadow-xl transition-all duration-300 hover:shadow-blue-200 hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                        {t('client.booking.submitting')}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        {t('client.booking.submit')}
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-6">
              {/* Résumé Card */}
              <Card className="border border-slate-100 shadow-xl rounded-3xl overflow-hidden bg-white">
                <div className="bg-slate-900 p-6 text-white">
                  <h3 className="font-black text-xl flex items-center gap-2">
                    {t('client.booking.summaryTitle')}
                  </h3>
                </div>
                <CardContent className="p-6">
                  {!selectedRoomData || nights <= 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Calendar className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">{t('client.booking.summaryEmpty')}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{t('client.booking.selectedRoom')}</p>
                        <p className="font-black text-slate-900 text-xl">{t('client.booking.roomNumber', { number: selectedRoomData.number })}</p>
                        <p className="text-sm font-medium text-slate-500">{selectedRoomData.type}</p>
                      </div>
                      
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                          <span>{t('client.booking.nightlyRate')}</span>
                          <span>{format.money(selectedRoomData.price)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                          <span>{t('client.booking.duration')}</span>
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{t('client.booking.nights', { count: nights })}</span>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t-2 border-dashed border-slate-200">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-black text-slate-900">{t('client.booking.total')}</span>
                          <span className="text-2xl font-black text-blue-600">{format.money(totalPrice)}</span>
                        </div>
                        <p className="text-xs text-right text-slate-400 mt-1 font-medium">{t('client.booking.estimate')}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="border border-slate-100 shadow-md rounded-3xl overflow-hidden bg-slate-50/50">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      <Clock className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{t('client.booking.arrivalTitle')}</p>
                      <p className="text-sm text-slate-500 mt-0.5 font-medium">{t('client.booking.arrivalText')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      <Shield className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{t('client.booking.paymentTitle')}</p>
                      <p className="text-sm text-slate-500 mt-0.5 font-medium">{t('client.booking.paymentText')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}