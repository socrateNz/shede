'use client';

import { useState } from 'react';
import { BedDouble, Pencil, Trash2, MoreVertical, CheckCircle, XCircle, Sparkles, Home, Hotel } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { updateRoom, updateRoomStatus, deleteRoom } from '@/app/actions/rooms';
import { useActionState } from 'react';
import { toast } from 'sonner';

export default function RoomsList({ rooms }: { rooms: any[] }) {
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

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

  const roomTypes: Record<string, string> = {
    Standard: '🏨 Standard',
    Double: '🛏️ Double',
    Studio: '✨ Studio',
    Suite: '👑 Suite',
    Familiale: '👨‍👩‍👧‍👦 Familiale',
    Autre: '📦 Autre',
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

  return (
    <>
      <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800/50">
              <TableHead className="text-slate-300 font-semibold w-16 text-center">Icône</TableHead>
              <TableHead className="text-slate-300 font-semibold">Numéro</TableHead>
              <TableHead className="text-slate-300 font-semibold">Type</TableHead>
              <TableHead className="text-slate-300 font-semibold">Statut</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => {
              const statusColor = statusColors[room.status] || statusColors.AVAILABLE;
              const StatusIcon = statusColor.icon;
              const isUpdatingStatus = updatingStatusId === room.id;

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
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getRoomTypeColor(room.type || 'Standard')}`}>
                      {roomTypes[room.type] || roomTypes.Standard}
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Modal modernisé */}
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