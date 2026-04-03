'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bed, CalendarDays, UtensilsCrossed, X, Edit, MapPin } from 'lucide-react';
import { ClientInvoiceWrapper } from '@/components/client-invoice-wrapper';
import { updateClientBooking, cancelClientOrder } from '@/app/actions/client-history';
import { toast } from 'sonner';

export function ClientHistoryList({ bookings, orders }: { bookings: any[], orders: any[] }) {
  const [activeTab, setActiveTab] = useState<'BOOKINGS' | 'ORDERS'>('BOOKINGS');
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBookingUpdate = async (e: React.FormEvent, action: 'UPDATE' | 'CANCEL') => {
    e.preventDefault();
    if (!editingBooking) return;
    setIsSubmitting(true);
    const res = await updateClientBooking(editingBooking.id, checkIn, checkOut, action);
    setIsSubmitting(false);
    
    if (res.success) {
      toast.success(action === 'UPDATE' ? 'Réservation modifiée avec succès' : 'Réservation annulée');
      setEditingBooking(null);
    } else {
      toast.error(res.error || 'Une erreur est survenue');
    }
  };

  const handleOrderCancel = async (orderId: string) => {
    if (!confirm('Voulez-vous vraiment annuler cette commande ?')) return;
    const res = await cancelClientOrder(orderId);
    if (res.success) {
      toast.success('Commande annulée');
    } else {
      toast.error(res.error || 'Erreur lors de l\'annulation');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 pb-2">
        <button 
          onClick={() => setActiveTab('BOOKINGS')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${activeTab === 'BOOKINGS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Mes Réservations ({bookings.length})
        </button>
        <button 
          onClick={() => setActiveTab('ORDERS')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${activeTab === 'ORDERS' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Mes Commandes ({orders.length})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'BOOKINGS' && (
          <div className="space-y-4">
            {bookings.length > 0 ? bookings.map((b: any) => (
              <Card key={b.id} className="hover:shadow-md transition bg-white border-slate-200">
                <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                      <Bed className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{b.rooms?.structures?.name || 'Hôtel'}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <span>Chambre {b.rooms?.number}</span>
                        <span>•</span>
                        <span>Du {new Date(b.check_in).toLocaleDateString('fr-FR')} au {new Date(b.check_out).toLocaleDateString('fr-FR')}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 justify-between md:justify-end">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider ${
                      b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                      b.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                      b.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {b.status}
                    </span>
                    {b.status === 'PENDING' && (
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingBooking(b);
                        setCheckIn(b.check_in.split('T')[0]);
                        setCheckOut(b.check_out.split('T')[0]);
                      }}>
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                <CalendarDays className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-lg font-medium">Aucune réservation</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="space-y-4">
            {orders.length > 0 ? orders.map((o: any) => (
              <Card key={o.id} className="hover:shadow-md transition bg-white border-slate-200">
                <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{o.structures?.name || 'Restaurant'}</h3>
                      <p className="text-sm text-slate-500">
                        {new Date(o.created_at).toLocaleString('fr-FR')} • <strong>{o.total} FCFA</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 justify-between md:justify-end">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider ${
                      o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      o.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                      o.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {o.status}
                    </span>
                    <ClientInvoiceWrapper order={o} />
                    {o.status === 'PENDING' && (
                      <Button variant="destructive" size="sm" onClick={() => handleOrderCancel(o.id)}>
                        <X className="w-4 h-4 mr-2" />
                        Annuler
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                <UtensilsCrossed className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-lg font-medium">Aucune commande</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editing Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Modification de la réservation</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setEditingBooking(null)}>
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  Établissement : <strong>{editingBooking.rooms?.structures?.name}</strong><br/>
                  Chambre : <strong>{editingBooking.rooms?.number}</strong>
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nouvelle Date d'arrivée</label>
                  <Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nouvelle Date de départ</label>
                  <Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} required min={checkIn || new Date().toISOString().split('T')[0]} />
                </div>
                
                <div className="flex flex-col gap-3 pt-4">
                  <Button 
                    type="submit" 
                    onClick={(e) => handleBookingUpdate(e, 'UPDATE')}
                    disabled={isSubmitting || !checkIn || !checkOut}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSubmitting ? 'Traitement...' : 'Enregistrer les dates'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={(e) => handleBookingUpdate(e, 'CANCEL')}
                    disabled={isSubmitting}
                    className="w-full text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                  >
                    Annuler la réservation complètement
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
