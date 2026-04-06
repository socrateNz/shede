'use client';

import { useState } from 'react';
import { BedDouble, Pencil, Trash2, MoreVertical, CheckCircle, XCircle, Sparkles, Home, Hotel, Eye, DollarSign, Tag, Calendar, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { updateRoom, updateRoomStatus, deleteRoom } from '@/app/actions/rooms';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { formatFCFA } from '@/lib/utils';
import { TablePagination } from './table-pagination';

export default function RoomsList({ rooms }: { rooms: any[] }) {
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [viewingRoom, setViewingRoom] = useState<any>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(rooms.length / itemsPerPage);
  const paginatedRooms = rooms.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  const [updateState, updateAction, isUpdating] = useActionState(
    async (prevState: any, formData: FormData) => {
      if (!editingRoom) return prevState;
      const res = await updateRoom(editingRoom.id, prevState, formData);
      if (res.success) {
        toast.success("Chambre mise à jour avec succès");
        setEditingRoom(null);
      }
      return res;
    },
    { success: false, error: '' }
  );

  const statusColors: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    AVAILABLE: { bg: 'bg-green-500/10', text: 'text-green-400', icon: CheckCircle, label: 'Disponible' },
    OCCUPIED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: XCircle, label: 'Occupée' },
    CLEANING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Sparkles, label: 'Nettoyage' },
  };

  const roomTypes: Record<string, { label: string; icon: string; description: string }> = {
    Standard: { label: 'Standard', icon: '🏨', description: 'Chambre classique avec équipements de base' },
    Double: { label: 'Double', icon: '🛏️', description: 'Chambre avec lit double, idéale pour les couples' },
    Studio: { label: 'Studio', icon: '✨', description: 'Espace moderne avec coin salon et cuisine' },
    Suite: { label: 'Suite', icon: '👑', description: 'Chambre de luxe avec salon séparé' },
    Familiale: { label: 'Familiale', icon: '👨‍👩‍👧‍👦', description: 'Grande chambre pour toute la famille' },
    Autre: { label: 'Autre', icon: '📦', description: 'Configuration spéciale' },
  };

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    setUpdatingStatusId(roomId);
    const res = await updateRoomStatus(roomId, newStatus);
    setUpdatingStatusId(null);
    if (!res.success) {
      toast.error("Erreur lors du changement de statut");
    } else {
      toast.success(`Statut mis à jour avec succès`);
    }
  };

  const handleDelete = async (roomId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette chambre ? Tout l'historique sera effacé.")) {
      const res = await deleteRoom(roomId);
      if (res.success) {
        toast.success("Chambre supprimée avec succès !");
      } else {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const getRoomTypeColor = (type: string) => {
    switch (type) {
      case 'Suite':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Double':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Studio':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Familiale':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = statusColors[status] || statusColors.AVAILABLE;
    const StatusIcon = statusConfig.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
        <StatusIcon className="w-3 h-3" />
        {statusConfig.label}
      </span>
    );
  };

  return (
    <>
      <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800/50">
              <TableHead className="text-slate-300 font-semibold w-16 text-center">Icône</TableHead>
              <TableHead className="text-slate-300 font-semibold">Numéro</TableHead>
              <TableHead className="text-slate-300 font-semibold">Prix / nuit</TableHead>
              <TableHead className="text-slate-300 font-semibold">Type</TableHead>
              <TableHead className="text-slate-300 font-semibold">Statut</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRooms.map((room) => {
              const statusColor = statusColors[room.status] || statusColors.AVAILABLE;
              const StatusIcon = statusColor.icon;
              const isUpdatingStatus = updatingStatusId === room.id;
              const roomType = roomTypes[room.type || 'Standard'];

              return (
                <TableRow
                  key={room.id}
                  className="border-slate-700 hover:bg-slate-800/50 transition-colors group"
                >
                  <TableCell className="text-center">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto">
                      <BedDouble className="w-5 h-5 text-blue-400" />
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-50 text-lg font-bold">{room.number}</TableCell>
                  <TableCell className="text-slate-50 font-bold">{formatFCFA(room.price)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getRoomTypeColor(room.type || 'Standard')}`}>
                      <span className="text-base">{roomType.icon}</span>
                      {roomType.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <select
                        value={room.status}
                        onChange={(e) => handleStatusChange(room.id, e.target.value)}
                        disabled={isUpdatingStatus}
                        className={`appearance-none cursor-pointer px-2.5 py-1 pr-8 rounded-full text-xs font-medium outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200 ${statusColor.bg} ${statusColor.text} ${isUpdatingStatus ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 0.5rem center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '1.25rem'
                        }}
                      >
                        <option value="AVAILABLE" className="bg-slate-800 text-green-400">✓ Disponible</option>
                        <option value="OCCUPIED" className="bg-slate-800 text-red-400">✗ Occupée</option>
                        <option value="CLEANING" className="bg-slate-800 text-yellow-400">✨ Nettoyage</option>
                      </select>
                      {isUpdatingStatus && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Bouton Voir les détails */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingRoom(room)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                        title="Voir les détails"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

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
                          className="w-40 bg-slate-800 border-slate-700 text-slate-200"
                        >
                          <DropdownMenuItem
                            onClick={() => setEditingRoom(room)}
                            className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2"
                          >
                            <Pencil className="w-4 h-4 text-blue-400" />
                            <span>Modifier</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem
                            onClick={() => handleDelete(room.id)}
                            className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Supprimer</span>
                          </DropdownMenuItem>
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

      {/* Dialog pour voir les détails de la chambre */}
      <Dialog open={!!viewingRoom} onOpenChange={(open) => !open && setViewingRoom(null)}>
        <DialogContent className="sm:max-w-lg bg-slate-800/95 backdrop-blur-sm border-slate-700/50 text-slate-50 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-lg pointer-events-none" />
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Hotel className="w-4 h-4 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Détails de la chambre</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400">
              Chambre n°{viewingRoom?.number}
            </DialogDescription>
          </DialogHeader>

          {viewingRoom && (
            <div className="space-y-4 mt-4">
              {/* En-tête avec statut */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <BedDouble className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Chambre</p>
                    <p className="text-2xl font-bold text-white">{viewingRoom.number}</p>
                  </div>
                </div>
                {getStatusBadge(viewingRoom.status)}
              </div>

              {/* Informations générales */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  Informations générales
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Type de chambre :</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getRoomTypeColor(viewingRoom.type || 'Standard')}`}>
                      <span className="text-base">{roomTypes[viewingRoom.type || 'Standard']?.icon}</span>
                      {roomTypes[viewingRoom.type || 'Standard']?.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Description :</span>
                    <span className="text-slate-300 text-right">
                      {roomTypes[viewingRoom.type || 'Standard']?.description || 'Chambre standard'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tarifs */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Tarifs
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Prix par nuit :</span>
                    <span className="text-slate-50 font-bold text-lg">
                      {formatFCFA(viewingRoom.price)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                    <span className="text-slate-400">Taxes incluses :</span>
                    <span className="text-green-400">Oui</span>
                  </div>
                </div>
              </div>

              {/* Capacité et équipements */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-400" />
                  Capacité
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Capacité maximale :</span>
                    <span className="text-slate-200">
                      {viewingRoom.capacity || 2} personne(s)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Lits :</span>
                    <span className="text-slate-200">
                      {viewingRoom.beds || 1} lit(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  Informations système
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ID Chambre :</span>
                    <span className="text-slate-300 font-mono text-xs">{viewingRoom.id?.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Créée le :</span>
                    <span className="text-slate-300">
                      {new Date(viewingRoom.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 gap-3">
            <Button
              type="button"
              onClick={() => setViewingRoom(null)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
        <DialogContent className="sm:max-w-[425px] bg-slate-800/95 backdrop-blur-sm border-slate-700/50 text-slate-50 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-lg pointer-events-none" />
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Hotel className="w-4 h-4 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Modifier la chambre</DialogTitle>
            </div>
            <p className="text-sm text-slate-400">Modifiez les informations de la chambre</p>
          </DialogHeader>
          <form action={updateAction} className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Home className="w-4 h-4 text-blue-400" />
                Numéro de chambre *
              </label>
              <Input
                name="roomNumber"
                defaultValue={editingRoom?.number}
                type="text"
                placeholder="Ex: 101, 202, Suite Royale"
                className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-purple-400" />
                Type de chambre
              </label>
              <select
                name="roomType"
                defaultValue={editingRoom?.type || 'Standard'}
                className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 cursor-pointer"
              >
                <option value="Standard">🏨 Standard</option>
                <option value="Double">🛏️ Double</option>
                <option value="Studio">✨ Studio</option>
                <option value="Suite">👑 Suite</option>
                <option value="Familiale">👨‍👩‍👧‍👦 Familiale</option>
                <option value="Autre">📦 Autre</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Prix par nuit (FCFA) *
              </label>
              <Input
                name="price"
                type="number"
                defaultValue={editingRoom?.price}
                step="1000"
                min="0"
                className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300"
                required
              />
            </div>

            {updateState.error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  {updateState.error}
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRoom(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 transition-all duration-300"
              >
                {isUpdating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enregistrement...
                  </div>
                ) : (
                  'Enregistrer'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}