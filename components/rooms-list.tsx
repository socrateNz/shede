'use client';

import { useState } from 'react';
import { BedDouble, Pencil, Trash2 } from 'lucide-react';
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

  const statusColors: Record<string, { bg: string; text: string }> = {
    AVAILABLE: { bg: 'bg-green-500/10', text: 'text-green-400' },
    OCCUPIED: { bg: 'bg-red-500/10', text: 'text-red-400' },
    CLEANING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  };

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    const res = await updateRoomStatus(roomId, newStatus);
    if (!res.success) {
       toast.error("Erreur lors du changement de statut");
    }
  };

  const handleDelete = async (roomId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette chambre ? Tout l'historique sera effacé.")) {
      const res = await deleteRoom(roomId);
      if (res.success) {
         toast.success("Chambre supprimée !");
      } else {
         toast.error("Erreur lors de la suppression");
      }
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-slate-800">
            <TableHead className="text-slate-300 w-16 text-center">Icone</TableHead>
            <TableHead className="text-slate-300">Numéro</TableHead>
            <TableHead className="text-slate-300">Type</TableHead>
            <TableHead className="text-slate-300">Statut</TableHead>
            <TableHead className="text-slate-300 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.map((room) => {
            const statusColor = statusColors[room.status] || statusColors.AVAILABLE;
            return (
              <TableRow key={room.id} className="border-slate-700 hover:bg-slate-700/50">
                <TableCell className="text-slate-400 text-center">
                  <BedDouble className="w-5 h-5 mx-auto" />
                </TableCell>
                <TableCell className="text-slate-50 text-lg font-bold">{room.number}</TableCell>
                <TableCell className="text-slate-400">{room.type || 'Standard'}</TableCell>
                <TableCell>
                  <select 
                    value={room.status}
                    onChange={(e) => handleStatusChange(room.id, e.target.value)}
                    className={`inline-flex items-center outline-none border-none cursor-pointer focus:ring-0 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide appearance-none ${statusColor.bg} ${statusColor.text}`}
                  >
                    <option value="AVAILABLE" className="bg-slate-800 text-green-400">DISPONIBLE</option>
                    <option value="OCCUPIED" className="bg-slate-800 text-red-400">OCCUPÉE</option>
                    <option value="CLEANING" className="bg-slate-800 text-yellow-400">NETTOYAGE</option>
                  </select>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setEditingRoom(room)}
                    className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(room.id)}
                    className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Edit Modal */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
        <DialogContent className="sm:max-w-[425px] bg-slate-800 border-slate-700 text-slate-50">
          <DialogHeader>
            <DialogTitle>Modifier la Chambre</DialogTitle>
          </DialogHeader>
          <form action={updateAction} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Numéro de Chambre *</label>
              <Input
                name="roomNumber"
                defaultValue={editingRoom?.number}
                type="text"
                className="bg-slate-700 border-slate-600 text-slate-50"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Type de Chambre</label>
              <select
                name="roomType"
                defaultValue={editingRoom?.type || 'Standard'}
                className="flex h-10 w-full rounded-md border bg-slate-700 border-slate-600 px-3 py-2 text-sm text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="Standard">Standard</option>
                <option value="Double">Double</option>
                <option value="Studio">Studio</option>
                <option value="Suite">Suite</option>
                <option value="Familiale">Familiale</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            
            {updateState.error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {updateState.error}
              </div>
            )}
            
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isUpdating ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
