'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bed, CalendarDays, UtensilsCrossed, X, Edit, MapPin } from 'lucide-react';
import { ClientInvoiceWrapper } from '@/components/client-invoice-wrapper';
import { updateClientBooking, cancelClientOrder } from '@/app/actions/client-history';
import { toast } from 'sonner';
import { TablePagination } from './table-pagination';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

export function ClientHistoryList({ bookings, orders }: { bookings: any[], orders: any[] }) {
  const [activeTab, setActiveTab] = useState<'BOOKINGS' | 'ORDERS'>('BOOKINGS');
  const { t, format } = useT();
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [bookingPage, setBookingPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const itemsPerPage = 10;

  const totalBookingPages = Math.ceil(bookings.length / itemsPerPage);
  const paginatedBookings = bookings.slice((bookingPage - 1) * itemsPerPage, bookingPage * itemsPerPage);

  const totalOrderPages = Math.ceil(orders.length / itemsPerPage);
  const paginatedOrders = orders.slice((orderPage - 1) * itemsPerPage, orderPage * itemsPerPage);

  if (bookingPage > totalBookingPages && totalBookingPages > 0) setBookingPage(1);
  if (orderPage > totalOrderPages && totalOrderPages > 0) setOrderPage(1);

  const handleBookingUpdate = async (e: React.FormEvent, action: 'UPDATE' | 'CANCEL') => {
    e.preventDefault();
    if (!editingBooking) return;
    setIsSubmitting(true);
    const res = await updateClientBooking(editingBooking.id, checkIn, checkOut, action);
    setIsSubmitting(false);
    
    if (res.success) {
      toast.success(action === 'UPDATE' ? t('client.history.bookingUpdated') : t('client.history.bookingCancelled'));
      setEditingBooking(null);
    } else {
      toast.error(res.error || t('client.history.genericError'));
    }
  };

  const handleOrderCancel = async (orderId: string) => {
    if (!confirm(t('client.history.confirmCancelOrder'))) return;
    const res = await cancelClientOrder(orderId);
    if (res.success) {
      toast.success(t('client.history.orderCancelled'));
    } else {
      toast.error(res.error || t('client.history.cancelError'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 pb-2">
        <button 
          onClick={() => setActiveTab('BOOKINGS')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${activeTab === 'BOOKINGS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {t('client.history.myBookings', { count: bookings.length })}
        </button>
        <button 
          onClick={() => setActiveTab('ORDERS')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${activeTab === 'ORDERS' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {t('client.history.myOrders', { count: orders.length })}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'BOOKINGS' && (
          <div className="space-y-4">
            {paginatedBookings.length > 0 ? paginatedBookings.map((b: any) => (
              <Card key={b.id} className="hover:shadow-md transition bg-white border-slate-200">
                <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                      <Bed className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{b.rooms?.structures?.name || t('client.dashboard.fallbackHotel')}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <span>{t('client.history.roomLine', { number: b.rooms?.number ?? '' })}</span>
                        <span>•</span>
                        <span>{t('client.history.fromTo', { from: format.date(b.check_in), to: format.date(b.check_out) })}</span>
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
                      {t(`client.clientStatus.booking.${b.status}` as TranslationKey)}
                    </span>
                    {b.status === 'PENDING' && (
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingBooking(b);
                        setCheckIn(b.check_in.split('T')[0]);
                        setCheckOut(b.check_out.split('T')[0]);
                      }}>
                        <Edit className="w-4 h-4 mr-2" />
                        {t('common.edit')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                <CalendarDays className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-lg font-medium">{t('client.history.noBookings')}</p>
              </div>
            )}
            <TablePagination 
              currentPage={bookingPage}
              totalPages={totalBookingPages}
              onPageChange={setBookingPage}
            />
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="space-y-4">
            {paginatedOrders.length > 0 ? paginatedOrders.map((o: any) => (
              <Card key={o.id} className="hover:shadow-md transition bg-white border-slate-200">
                <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{o.structures?.name || t('client.dashboard.fallbackRestaurant')}</h3>
                      <p className="text-sm text-slate-500">
                        {format.dateTime(o.created_at)} • <strong>{format.money(o.total)}</strong>
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
                      {t(`client.clientStatus.order.${o.status}` as TranslationKey)}
                    </span>
                    <ClientInvoiceWrapper order={o} />
                    {o.status === 'PENDING' && (
                      <Button variant="destructive" size="sm" onClick={() => handleOrderCancel(o.id)}>
                        <X className="w-4 h-4 mr-2" />
                        {t('common.cancel')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                <UtensilsCrossed className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-lg font-medium">{t('client.history.noOrders')}</p>
              </div>
            )}
            <TablePagination 
              currentPage={orderPage}
              totalPages={totalOrderPages}
              onPageChange={setOrderPage}
            />
          </div>
        )}
      </div>

      {/* Editing Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('client.history.editTitle')}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setEditingBooking(null)}>
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {t('client.history.place')} <strong>{editingBooking.rooms?.structures?.name}</strong><br/>
                  {t('client.history.room')} <strong>{editingBooking.rooms?.number}</strong>
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">{t('client.history.newCheckIn')}</label>
                  <Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">{t('client.history.newCheckOut')}</label>
                  <Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} required min={checkIn || new Date().toISOString().split('T')[0]} />
                </div>
                
                <div className="flex flex-col gap-3 pt-4">
                  <Button 
                    type="submit" 
                    onClick={(e) => handleBookingUpdate(e, 'UPDATE')}
                    disabled={isSubmitting || !checkIn || !checkOut}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSubmitting ? t('client.history.processing') : t('client.history.saveDates')}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={(e) => handleBookingUpdate(e, 'CANCEL')}
                    disabled={isSubmitting}
                    className="w-full text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                  >
                    {t('client.history.cancelBooking')}
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
