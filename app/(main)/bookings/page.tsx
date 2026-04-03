import { requireRole } from '@/app/actions/auth';
import { getBookings, updateBookingStatus } from '@/app/actions/bookings';
import { getSession } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, CalendarDays, CheckCircle, XCircle, Clock, UserCheck, DollarSign, MoreVertical } from 'lucide-react';
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
import { PrintReceiptButton } from '@/components/print-receipt-button';

const statusColors: Record<string, { bg: string; text: string; icon: any }> = {
  PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Clock },
  CONFIRMED: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: CheckCircle },
  IN_PROGRESS: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: UserCheck },
  COMPLETED: { bg: 'bg-green-500/10', text: 'text-green-400', icon: DollarSign },
  CANCELLED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: XCircle },
};

const statusLabels: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export default async function BookingsPage() {
  const session = await requireRole('ADMIN', 'RECEPTION');

  if (!session?.structureId) return null;
  const bookings = await getBookings(session.structureId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Gestion des réservations</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              Réservations
            </h1>
            <p className="text-slate-400">Gérez les réservations hôtelières et le suivi des clients</p>
          </div>
          <Link href="/bookings/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle réservation
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300">
            <div className="text-2xl font-bold text-white">{bookings.length}</div>
            <div className="text-sm text-slate-400">Total</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300">
            <div className="text-2xl font-bold text-yellow-400">{bookings.filter((b: any) => b.status === 'PENDING').length}</div>
            <div className="text-sm text-slate-400">En attente</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300">
            <div className="text-2xl font-bold text-blue-400">{bookings.filter((b: any) => b.status === 'CONFIRMED').length}</div>
            <div className="text-sm text-slate-400">Confirmées</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300">
            <div className="text-2xl font-bold text-purple-400">{bookings.filter((b: any) => b.status === 'IN_PROGRESS').length}</div>
            <div className="text-sm text-slate-400">En cours</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300">
            <div className="text-2xl font-bold text-green-400">{bookings.filter((b: any) => b.status === 'COMPLETED').length}</div>
            <div className="text-sm text-slate-400">Terminées</div>
          </div>
        </div>

        {/* Tableau des réservations */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-400" />
              Liste des réservations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {bookings.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Aucune réservation trouvée</p>
                <p className="text-sm mt-2">Commencez par créer une nouvelle réservation</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-300 font-semibold">Chambre</TableHead>
                      <TableHead className="text-slate-300 font-semibold">Client</TableHead>
                      <TableHead className="text-slate-300 font-semibold">Arrivée</TableHead>
                      <TableHead className="text-slate-300 font-semibold">Départ</TableHead>
                      <TableHead className="text-slate-300 font-semibold">Montant</TableHead>
                      <TableHead className="text-slate-300 font-semibold">Statut</TableHead>
                      <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking: any) => {
                      const StatusIcon = statusColors[booking.status]?.icon || Clock;
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
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[booking.status]?.bg} ${statusColors[booking.status]?.text}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusLabels[booking.status] || booking.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
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
                                {/* Actions selon le statut */}

                                {booking.status === 'PENDING' && (
                                  <>
                                    <form action={async () => {
                                      'use server';
                                      await updateBookingStatus(booking.id, 'CONFIRMED', booking.room_id);
                                    }}>
                                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                                        <button type="submit" className="w-full flex items-center gap-2 text-blue-400">
                                          <CheckCircle className="w-4 h-4" />
                                          <span>Accepter la réservation</span>
                                        </button>
                                      </DropdownMenuItem>
                                    </form>
                                    <form action={async () => {
                                      'use server';
                                      await updateBookingStatus(booking.id, 'CANCELLED', booking.room_id);
                                    }}>
                                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                                        <button type="submit" className="w-full flex items-center gap-2 text-red-400">
                                          <XCircle className="w-4 h-4" />
                                          <span>Refuser la réservation</span>
                                        </button>
                                      </DropdownMenuItem>
                                    </form>
                                  </>
                                )}

                                {booking.status === 'CONFIRMED' && (
                                  <>
                                    <form action={async () => {
                                      'use server';
                                      await updateBookingStatus(booking.id, 'IN_PROGRESS', booking.room_id);
                                    }}>
                                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                                        <button type="submit" className="w-full flex items-center gap-2 text-purple-400">
                                          <UserCheck className="w-4 h-4" />
                                          <span>Check-in (Arrivée client)</span>
                                        </button>
                                      </DropdownMenuItem>
                                    </form>
                                    <DropdownMenuSeparator className="bg-slate-700" />
                                    <form action={async () => {
                                      'use server';
                                      await updateBookingStatus(booking.id, 'COMPLETED', booking.room_id);
                                    }}>
                                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                                        <button type="submit" className="w-full flex items-center gap-2 text-green-400">
                                          <DollarSign className="w-4 h-4" />
                                          <span>Encaisser directement</span>
                                        </button>
                                      </DropdownMenuItem>
                                    </form>
                                    <DropdownMenuSeparator className="bg-slate-700" />
                                    <form action={async () => {
                                      'use server';
                                      await updateBookingStatus(booking.id, 'CANCELLED', booking.room_id);
                                    }}>
                                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                                        <button type="submit" className="w-full flex items-center gap-2 text-red-400">
                                          <XCircle className="w-4 h-4" />
                                          <span>Annuler la réservation</span>
                                        </button>
                                      </DropdownMenuItem>
                                    </form>
                                  </>
                                )}

                                {booking.status === 'IN_PROGRESS' && (
                                  <>
                                    <form action={async () => {
                                      'use server';
                                      await updateBookingStatus(booking.id, 'COMPLETED', booking.room_id);
                                    }}>
                                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                                        <button type="submit" className="w-full flex items-center gap-2 text-green-400">
                                          <DollarSign className="w-4 h-4" />
                                          <span>Finaliser et encaisser</span>
                                        </button>
                                      </DropdownMenuItem>
                                    </form>
                                    <DropdownMenuSeparator className="bg-slate-700" />
                                    <form action={async () => {
                                      'use server';
                                      await updateBookingStatus(booking.id, 'CANCELLED', booking.room_id);
                                    }}>
                                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                                        <button type="submit" className="w-full flex items-center gap-2 text-red-400">
                                          <XCircle className="w-4 h-4" />
                                          <span>Annuler la réservation</span>
                                        </button>
                                      </DropdownMenuItem>
                                    </form>
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

                                {/* Lien pour voir les détails */}
                                {(booking.status === 'CONFIRMED' || booking.status === 'PENDING' || booking.status === 'IN_PROGRESS') && (
                                  <>
                                    <DropdownMenuSeparator className="bg-slate-700" />
                                    <Link href={`/bookings/${booking.id}/edit`}>
                                      <DropdownMenuItem className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700">
                                        <div className="flex items-center gap-2 text-slate-400">
                                          <MoreVertical className="w-4 h-4" />
                                          <span>Voir les détails</span>
                                        </div>
                                      </DropdownMenuItem>
                                    </Link>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer avec légende des statuts */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>En attente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Confirmée</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span>En cours</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>Terminée</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span>Annulée</span>
          </div>
        </div>
      </div>
    </div>
  );
}