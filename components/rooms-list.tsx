'use client';

import { useState } from 'react';
import { ImageUpload } from '@/components/image-upload';
import { BedDouble, Pencil, Trash2, MoreVertical, CheckCircle, XCircle, Home, Hotel, Eye, DollarSign, Tag, Calendar, Info, Sparkles, Image as ImageIcon } from 'lucide-react';
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
import { TablePagination } from './table-pagination';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';

type RoomType = 'Standard' | 'Double' | 'Studio' | 'Suite' | 'Familiale' | 'Autre';

export default function RoomsList({ rooms }: { rooms: any[] }) {
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [viewingRoom, setViewingRoom] = useState<any>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { t, format } = useT();
  const dialogs = useDialogs();
  
  const [editImage1, setEditImage1] = useState<string | null>(null);
  const [editImage2, setEditImage2] = useState<string | null>(null);

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
        toast.success(t('hotel.rooms.updated'));
        setEditingRoom(null);
      }
      return res;
    },
    { success: false, error: '' }
  );

  const statusColors: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    AVAILABLE: { bg: 'bg-green-500/10', text: 'text-green-400', icon: CheckCircle, label: t('hotel.roomStatus.AVAILABLE') },
    OCCUPIED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: XCircle, label: t('hotel.roomStatus.OCCUPIED') },
    CLEANING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Sparkles, label: t('hotel.roomStatus.CLEANING') },
  };

  const roomTypeIcons: Record<RoomType, string> = {
    Standard: '🏨', Double: '🛏️', Studio: '✨', Suite: '👑', Familiale: '👨‍👩‍👧‍👦', Autre: '📦',
  };
  const roomTypes = Object.fromEntries(
    (Object.keys(roomTypeIcons) as RoomType[]).map((type) => [type, {
      label: t(`hotel.roomTypes.${type}.label`),
      icon: roomTypeIcons[type],
      description: t(`hotel.roomTypes.${type}.description`),
    }]),
  ) as Record<string, { label: string; icon: string; description: string }>;
  const roomTypeOf = (type?: string | null) =>
    roomTypes[type || 'Standard'] ?? { label: type ?? '', icon: '📦', description: '' };

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    setUpdatingStatusId(roomId);
    const res = await updateRoomStatus(roomId, newStatus);
    setUpdatingStatusId(null);
    if (!res.success) {
      toast.error(t('hotel.rooms.statusError'));
    } else {
      toast.success(t('hotel.rooms.statusUpdated'));
    }
  };

  const handleDelete = async (roomId: string) => {
    if (await dialogs.confirm({ description: t('hotel.rooms.confirmDelete'), destructive: true })) {
      const res = await deleteRoom(roomId);
      if (res.success) {
        toast.success(t('hotel.rooms.deleted'));
      } else {
        toast.error(t('hotel.rooms.deleteError'));
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
              <TableHead className="text-slate-300 font-semibold w-16 text-center">{t('hotel.rooms.colIcon')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('hotel.rooms.colNumber')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('hotel.rooms.colPrice')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('hotel.rooms.colType')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('hotel.rooms.colStatus')}</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">{t('hotel.rooms.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRooms.map((room) => {
              const statusColor = statusColors[room.status] || statusColors.AVAILABLE;
              const StatusIcon = statusColor.icon;
              const isUpdatingStatus = updatingStatusId === room.id;
              const roomType = roomTypeOf(room.type);

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
                  <TableCell className="text-slate-50 font-bold">{format.money(room.price)}</TableCell>
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
                        <option value="AVAILABLE" className="bg-slate-800 text-green-400">✓ {t('hotel.roomStatus.AVAILABLE')}</option>
                        <option value="OCCUPIED" className="bg-slate-800 text-red-400">✗ {t('hotel.roomStatus.OCCUPIED')}</option>
                        <option value="CLEANING" className="bg-slate-800 text-yellow-400">✨ {t('hotel.roomStatus.CLEANING')}</option>
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
                        title={t('hotel.rooms.viewDetails')}
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
                            onClick={() => {
                              setEditingRoom(room);
                              setEditImage1(room.images?.[0] || null);
                              setEditImage2(room.images?.[1] || null);
                            }}
                            className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2"
                          >
                            <Pencil className="w-4 h-4 text-blue-400" />
                            <span>{t('common.edit')}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem
                            onClick={() => handleDelete(room.id)}
                            className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{t('common.delete')}</span>
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
              <DialogTitle className="text-xl font-bold">{t('hotel.roomDetails.title')}</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400">
              {t('hotel.roomDetails.number', { number: viewingRoom?.number ?? '' })}
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
                    <p className="text-sm text-slate-400">{t('hotel.roomDetails.room')}</p>
                    <p className="text-2xl font-bold text-white">{viewingRoom.number}</p>
                  </div>
                </div>
                {getStatusBadge(viewingRoom.status)}
              </div>

              {/* Informations générales */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  {t('hotel.roomDetails.general')}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{t('hotel.roomDetails.type')}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getRoomTypeColor(viewingRoom.type || 'Standard')}`}>
                      <span className="text-base">{roomTypeOf(viewingRoom.type).icon}</span>
                      {roomTypeOf(viewingRoom.type).label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{t('hotel.roomDetails.description')}</span>
                    <span className="text-slate-300 text-right">
                      {roomTypeOf(viewingRoom.type).description}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tarifs */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  {t('hotel.roomDetails.pricing')}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{t('hotel.roomDetails.pricePerNight')}</span>
                    <span className="text-slate-50 font-bold text-lg">
                      {format.money(viewingRoom.price)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Capacité et équipements */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-400" />
                  {t('hotel.roomDetails.capacity')}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{t('hotel.roomDetails.maxCapacity')}</span>
                    <span className="text-slate-200">
                      {t('hotel.roomDetails.persons', { count: viewingRoom.capacity || 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{t('hotel.roomDetails.beds')}</span>
                    <span className="text-slate-200">
                      {t('hotel.roomDetails.bedCount', { count: viewingRoom.beds || 1 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  {t('hotel.roomDetails.system')}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('hotel.roomDetails.id')}</span>
                    <span className="text-slate-300 font-mono text-xs">{viewingRoom.id?.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('hotel.roomDetails.createdAt')}</span>
                    <span className="text-slate-300">
                      {format.date(viewingRoom.created_at)}
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
              {t('hotel.roomDetails.close')}
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
              <DialogTitle className="text-xl font-bold">{t('hotel.roomForm.editTitle')}</DialogTitle>
            </div>
            <p className="text-sm text-slate-400">{t('hotel.roomForm.editSubtitle')}</p>
          </DialogHeader>
          <form action={updateAction} className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Home className="w-4 h-4 text-blue-400" />
                {t('hotel.roomForm.number')}
              </label>
              <Input
                name="roomNumber"
                defaultValue={editingRoom?.number}
                type="text"
                placeholder={t('hotel.roomForm.numberPlaceholder')}
                className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-purple-400" />
                {t('hotel.roomForm.type')}
              </label>
              <select
                name="roomType"
                defaultValue={editingRoom?.type || 'Standard'}
                className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 cursor-pointer"
              >
                <option value="Standard">🏨 {t('hotel.roomTypes.Standard.label')}</option>
                <option value="Double">🛏️ {t('hotel.roomTypes.Double.label')}</option>
                <option value="Studio">✨ {t('hotel.roomTypes.Studio.label')}</option>
                <option value="Suite">👑 {t('hotel.roomTypes.Suite.label')}</option>
                <option value="Familiale">👨‍👩‍👧‍👦 {t('hotel.roomTypes.Familiale.label')}</option>
                <option value="Autre">📦 {t('hotel.roomTypes.Autre.label')}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                {t('hotel.roomForm.price')}
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

            <div className="space-y-3 pt-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                {t('hotel.roomForm.imagesShort')}
              </label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input type="hidden" name="image1" value={editImage1 || ''} />
                  <ImageUpload value={editImage1} onChange={setEditImage1} disabled={isUpdating} />
                </div>
                <div className="flex-1">
                  <input type="hidden" name="image2" value={editImage2 || ''} />
                  <ImageUpload value={editImage2} onChange={setEditImage2} disabled={isUpdating} />
                </div>
              </div>
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
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 transition-all duration-300"
              >
                {isUpdating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('hotel.roomForm.saving')}
                  </div>
                ) : (
                  t('hotel.roomForm.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}