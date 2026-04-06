'use client';

import { useState } from 'react';
import { TablePagination } from './table-pagination';
import { Button } from '@/components/ui/button';
import { 
  Clock, CheckCircle, XCircle, UserCheck, Receipt, DollarSign, 
  MoreVertical, CreditCard, Eye, User, Phone, Calendar, Building2 
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PrintReceiptButton } from '@/components/print-receipt-button';
import { formatFCFA } from '@/lib/utils';
import { updateBookingStatus, markBookingAsPaid } from '@/app/actions/bookings';

const statusColors: Record<string, { bg: string; text: string; icon: any }> = {
  PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Clock },
  CONFIRMED: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: CheckCircle },
  IN_PROGRESS: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: UserCheck },
  COMPLETED: { bg: 'bg-green-500/10', text: 'text-green-400', icon: Receipt },
  CANCELLED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: XCircle },
};

const statusLabels: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export function BookingsList({ bookings }: { bookings: any[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(bookings.length / itemsPerPage);
  const paginatedBookings = bookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-2xl overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-300 font-semibold">Chambre</TableHead>
              <TableHead className="text-slate-300 font-semibold">Client</TableHead>
              <TableHead className="text-slate-300 font-semibold">Arrivée</TableHead>
              <TableHead className="text-slate-300 font-semibold">Départ</TableHead>
              <TableHead className="text-slate-300 font-semibold">Montant</TableHead>
              <TableHead className="text-slate-300 font-semibold">Paiement</TableHead>
              <TableHead className="text-slate-300 font-semibold">Statut</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBookings.map((booking: any) => {
              const StatusIcon = statusColors[booking.status]?.icon || Clock
              const numberOfNights = Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))
              return (
                <TableRow
                  key={booking.id}
                  className="border-slate-700 hover:bg-slate-800/50 transition-colors group"
                >
                  <TableCell className="font-medium text-slate-200">
                    <div className="flex flex-col">
                      <span className="text-white font-semibold">{booking.rooms?.number}</span>
                      <span className="text-xs text-slate-400">{booking.rooms?.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {booking.users ? `${booking.users.first_name} ${booking.users.last_name}` : 'Walk-in'}
                      </span>
                      {booking.phone && (
                        <span className="text-xs text-slate-400 mt-1">{booking.phone}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <div className="flex flex-col">
                      <span className="text-sm">{new Date(booking.check_in).toLocaleDateString('fr-FR')}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(booking.check_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <div className="flex flex-col">
                      <span className="text-sm">{new Date(booking.check_out).toLocaleDateString('fr-FR')}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(booking.check_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <span className="font-bold text-white">{booking.total_amount?.toLocaleString()} FCFA</span>
                  </TableCell>
                  <TableCell>
                    {booking.is_paid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider border border-green-500/30">
                        <DollarSign className="w-3 h-3" />
                        Payé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-600">
                        <Clock className="w-3 h-3" />
                        En attente
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[booking.status]?.bg} ${statusColors[booking.status]?.text}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusLabels[booking.status] || booking.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                            title="Voir les détails"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg bg-slate-800/95 backdrop-blur-sm border-slate-700/50 text-slate-50">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                              <Receipt className="w-5 h-5 text-blue-400" />
                              Détails de la réservation
                            </DialogTitle>
                            <DialogDescription className="text-slate-400">
                              N° {booking.id.slice(0, 8)}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4 mt-4">
                            <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-400" />
                                Informations client
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Nom complet :</span>
                                  <span className="text-slate-200 font-medium">
                                    {booking.users ? `${booking.users.first_name} ${booking.users.last_name}` : 'Walk-in'}
                                  </span>
                                </div>
                                {booking.phone && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Téléphone :</span>
                                    <span className="text-slate-200">{booking.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-purple-400" />
                                Informations chambre
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Chambre :</span>
                                  <span className="text-slate-200 font-medium">{booking.rooms?.number}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Type :</span>
                                  <span className="text-slate-200">{booking.rooms?.type}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Prix / nuit :</span>
                                  <span className="text-slate-200">{formatFCFA(booking.total_amount / numberOfNights)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-400" />
                                Informations séjour
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Arrivée :</span>
                                  <span className="text-slate-200">
                                    {new Date(booking.check_in).toLocaleDateString('fr-FR')} à {new Date(booking.check_in).toLocaleTimeString('fr-FR')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Départ :</span>
                                  <span className="text-slate-200">
                                    {new Date(booking.check_out).toLocaleDateString('fr-FR')} à {new Date(booking.check_out).toLocaleTimeString('fr-FR')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-green-400" />
                                Informations paiement
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Montant total :</span>
                                  <span className="text-slate-200 font-bold text-lg">{formatFCFA(booking.total_amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Statut paiement :</span>
                                  <span className={booking.is_paid ? 'text-green-400' : 'text-yellow-400'}>
                                    {booking.is_paid ? 'Payé' : 'En attente'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 bg-slate-800 border-slate-700 text-slate-200"
                        >
                          {booking.status === 'PENDING' && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => updateBookingStatus(booking.id, 'CONFIRMED', booking.room_id)}
                                className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-blue-400"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Accepter la réservation</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateBookingStatus(booking.id, 'CANCELLED', booking.room_id)}
                                className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-red-400"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>Refuser la réservation</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {booking.status === 'CONFIRMED' && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => updateBookingStatus(booking.id, 'IN_PROGRESS', booking.room_id)}
                                className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-purple-400"
                              >
                                <UserCheck className="w-4 h-4" />
                                <span>Check-in (Arrivée client)</span>
                              </DropdownMenuItem>
                              {!booking.is_paid && (
                                <DropdownMenuItem 
                                  onClick={() => markBookingAsPaid(booking.id)}
                                  className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-green-400"
                                >
                                  <CreditCard className="w-4 h-4" />
                                  <span>Encaisser l'acompte</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-slate-700" />
                              <DropdownMenuItem 
                                onClick={() => updateBookingStatus(booking.id, 'CANCELLED', booking.room_id)}
                                className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-red-400"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>Annuler la réservation</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {booking.status === 'IN_PROGRESS' && (
                            <>
                              {!booking.is_paid && (
                                <DropdownMenuItem 
                                  onClick={() => markBookingAsPaid(booking.id)}
                                  className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-green-400"
                                >
                                  <CreditCard className="w-4 h-4" />
                                  <span>Encaisser paiement</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => updateBookingStatus(booking.id, 'COMPLETED', booking.room_id)}
                                className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-blue-400"
                              >
                                <Receipt className="w-4 h-4" />
                                <span>Finaliser (Check-out)</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-700" />
                              <DropdownMenuItem 
                                onClick={() => updateBookingStatus(booking.id, 'CANCELLED', booking.room_id)}
                                className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-red-400"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>Annuler la réservation</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {booking.status === 'COMPLETED' && (
                            <PrintReceiptButton booking={booking} />
                          )}

                          {booking.status === 'CANCELLED' && (
                            <div className="px-2 py-1.5 text-sm text-slate-500 text-center">
                              ✗ Réservation annulée
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <TablePagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
