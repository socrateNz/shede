'use client';

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateTablePosition, deleteTable } from '@/app/actions/tables';
import { renameFloor, deleteFloor } from '@/app/actions/floors';
import { Trash2, Edit2, CheckCircle2, GripHorizontal, Users, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AddFloorDialog } from '@/components/add-floor-dialog';
import { EditTableDialog } from '@/components/edit-table-dialog';
import type { Floor } from '@/lib/supabase';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';

interface Table {
  id: string;
  name: string;
  capacity: number;
  shape: 'round' | 'square' | 'rectangle';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  floor_name: string;
  floor_id: string | null;
  status: string;
}

export function FloorManagerClient({ initialTables, activeOrders, floors: initialFloors }: { initialTables: Table[], activeOrders: any[], floors: Floor[] }) {
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [floors, setFloors] = useState<Floor[]>(initialFloors);
  const [activeFloorId, setActiveFloorId] = useState<string>(initialFloors[0]?.id || '');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [renamingFloorId, setRenamingFloorId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useT();
  const dialogs = useDialogs();

  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  useEffect(() => {
    setFloors(initialFloors);
  }, [initialFloors]);

  if (floors.length > 0 && !floors.some(f => f.id === activeFloorId)) {
    setActiveFloorId(floors[0].id);
  }

  const activeFloor = floors.find(f => f.id === activeFloorId);
  const floorTables = tables.filter(tb =>
    tb.floor_id === activeFloorId || (!tb.floor_id && activeFloor && tb.floor_name === activeFloor.name)
  );

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (!isEditMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditMode || !draggingId || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;

    // Grid snaping (every 20px)
    const snappedX = Math.round(x / 20) * 20;
    const snappedY = Math.round(y / 20) * 20;

    setTables(prev => prev.map(tb => {
      if (tb.id === draggingId) {
        return { ...tb, position_x: snappedX - tb.width / 2, position_y: snappedY - tb.height / 2 };
      }
      return tb;
    }));
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!isEditMode || !draggingId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const table = tables.find(tb => tb.id === draggingId);
    if (table) {
      await updateTablePosition(table.id, table.position_x, table.position_y);
    }
    setDraggingId(null);
  };

  const handleDelete = async (id: string) => {
    if (await dialogs.confirm({ description: t('floor.manager.confirmDeleteTable'), destructive: true })) {
      const result = await deleteTable(id);
      if (result.success) {
        setTables(prev => prev.filter(tb => tb.id !== id));
        toast.success(t('floor.manager.tableDeleted'));
      } else {
        toast.error(result.error);
      }
    }
  };

  const handleTableUpdated = (updated: any) => {
    setTables(prev => prev.map(tb => (tb.id === updated.id ? { ...tb, ...updated } : tb)));
  };

  const handleFloorCreated = (floor: Floor) => {
    setFloors(prev => [...prev, floor]);
    setActiveFloorId(floor.id);
  };

  const startRenameFloor = (floor: Floor) => {
    setRenamingFloorId(floor.id);
    setRenameValue(floor.name);
  };

  const cancelRenameFloor = () => {
    setRenamingFloorId(null);
    setRenameValue('');
  };

  const saveRenameFloor = async (id: string) => {
    if (!renameValue.trim()) {
      cancelRenameFloor();
      return;
    }
    const result = await renameFloor(id, renameValue.trim());
    if (result.success && result.floor) {
      setFloors(prev => prev.map(f => (f.id === id ? result.floor : f)));
      setTables(prev => prev.map(tb => (tb.floor_id === id ? { ...tb, floor_name: result.floor.name } : tb)));
      toast.success(t('floor.manager.floorRenamed'));
    } else {
      toast.error(result.error || t('floor.manager.renameError'));
    }
    cancelRenameFloor();
  };

  const handleDeleteFloor = async (floor: Floor) => {
    if (!(await dialogs.confirm({ description: t('floor.manager.confirmDeleteFloor', { name: floor.name }), destructive: true }))) return;
    const result = await deleteFloor(floor.id);
    if (result.success) {
      setFloors(prev => prev.filter(f => f.id !== floor.id));
      toast.success(t('floor.manager.floorDeleted'));
    } else {
      toast.error(result.error);
    }
  };

  // Helper pour savoir si une table est occupée (commande IN_PROGRESS ou PENDING associée)
  const isTableOccupied = (table: Table) => {
    return activeOrders.some(order => order.table_id === table.id || order.table_number?.toString() === table.name);
  };

  return (
    <div className="space-y-6">
      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50">
        <div className="flex gap-2 flex-wrap items-center">
          {floors.map(floor => (
            renamingFloorId === floor.id ? (
              <div key={floor.id} className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRenameFloor(floor.id);
                    if (e.key === 'Escape') cancelRenameFloor();
                  }}
                  className="bg-slate-900 border-slate-600 h-9 w-32"
                />
                <button onClick={() => saveRenameFloor(floor.id)} className="text-emerald-400 hover:text-emerald-300">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={cancelRenameFloor} className="text-slate-400 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div key={floor.id} className="flex items-center gap-1">
                <Button
                  variant={activeFloorId === floor.id ? 'default' : 'outline'}
                  className={activeFloorId === floor.id ? 'bg-indigo-600 hover:bg-indigo-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
                  onClick={() => setActiveFloorId(floor.id)}
                >
                  {floor.name}
                </Button>
                {isEditMode && (
                  <>
                    <button
                      onClick={() => startRenameFloor(floor)}
                      className="text-slate-400 hover:text-white p-1"
                      title={t('floor.manager.renameFloor')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFloor(floor)}
                      className="text-slate-400 hover:text-red-400 p-1"
                      title={t('floor.manager.deleteFloor')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )
          ))}
          <AddFloorDialog onCreated={handleFloorCreated} />
        </div>

        <div className="flex gap-4 items-center">
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            className={isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> {t('floor.manager.finishEditing')}</>
            ) : (
              <><Edit2 className="w-4 h-4 mr-2" /> {t('floor.manager.editPlan')}</>
            )}
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <Card className="bg-slate-900 border-slate-700/50 overflow-hidden relative" style={{ minHeight: '600px' }}>
        {/* Grille de fond (visible en mode édition) */}
        {isEditMode && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />
        )}

        <div
          ref={containerRef}
          className="absolute inset-0 touch-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {floorTables.map(table => {
            const occupied = isTableOccupied(table);
            const isRound = table.shape === 'round';

            return (
              <div
                key={table.id}
                onPointerDown={(e) => handlePointerDown(e, table.id)}
                className={`absolute transition-colors flex flex-col items-center justify-center shadow-lg ${
                  isEditMode ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-white/50' : ''
                } ${
                  isRound ? 'rounded-full' : 'rounded-lg'
                } ${
                  occupied
                    ? 'bg-red-500/20 border-2 border-red-500/50 shadow-red-500/10'
                    : 'bg-emerald-500/20 border-2 border-emerald-500/50 shadow-emerald-500/10'
                }`}
                style={{
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                  transform: `translate(${table.position_x}px, ${table.position_y}px)`,
                  transition: draggingId === table.id ? 'none' : 'transform 0.2s',
                  zIndex: draggingId === table.id ? 50 : 10,
                }}
              >
                {isEditMode && (
                  <GripHorizontal className="absolute -top-3 text-slate-400 w-5 h-5 opacity-50" />
                )}

                <span className="font-bold text-white text-lg tracking-wider">{table.name}</span>

                <div className="flex items-center gap-1 text-slate-300 mt-1 opacity-80">
                  <Users className="w-3 h-3" />
                  <span className="text-xs font-medium">{table.capacity}</span>
                </div>

                {isEditMode && (
                  <>
                    <EditTableDialog table={table} onUpdated={handleTableUpdated} />
                    <button
                      className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 hover:scale-110 transition-all z-20"
                      onPointerDown={(e) => e.stopPropagation()}
                      title={t('floor.manager.deleteTable')}
                      aria-label={t('floor.manager.deleteTable')}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(table.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {floorTables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <p className="text-lg">{t('floor.manager.emptyTitle')}</p>
              <p className="text-sm">{t('floor.manager.emptyText')}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
