'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateTablePosition, deleteTable } from '@/app/actions/tables';
import { Plus, Trash2, Edit2, CheckCircle2, GripHorizontal, Users } from 'lucide-react';
import { toast } from 'sonner';

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
  status: string;
}

export function FloorManagerClient({ initialTables, activeOrders }: { initialTables: Table[], activeOrders: any[] }) {
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [activeFloor, setActiveFloor] = useState<string>('Salle principale');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  const floors = Array.from(new Set(tables.map(t => t.floor_name)));
  if (floors.length === 0) floors.push('Salle principale');
  if (!floors.includes(activeFloor)) setActiveFloor(floors[0]);

  const floorTables = tables.filter(t => t.floor_name === activeFloor);

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

    setTables(prev => prev.map(t => {
      if (t.id === draggingId) {
        return { ...t, position_x: snappedX - t.width / 2, position_y: snappedY - t.height / 2 };
      }
      return t;
    }));
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!isEditMode || !draggingId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const table = tables.find(t => t.id === draggingId);
    if (table) {
      await updateTablePosition(table.id, table.position_x, table.position_y);
    }
    setDraggingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer cette table ?')) {
      const result = await deleteTable(id);
      if (result.success) {
        setTables(prev => prev.filter(t => t.id !== id));
        toast.success('Table supprimée');
      } else {
        toast.error(result.error);
      }
    }
  };

  // Helper pour savoir si une table est occupée (commande IN_PROGRESS ou PENDING associée)
  const isTableOccupied = (tableNumber: string) => {
    return activeOrders.some(order => order.table_number?.toString() === tableNumber || order.table_id === tableNumber);
  };

  return (
    <div className="space-y-6">
      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50">
        <div className="flex gap-2">
          {floors.map(floor => (
            <Button
              key={floor}
              variant={activeFloor === floor ? 'default' : 'outline'}
              className={activeFloor === floor ? 'bg-indigo-600 hover:bg-indigo-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
              onClick={() => setActiveFloor(floor)}
            >
              {floor}
            </Button>
          ))}
        </div>
        
        <div className="flex gap-4 items-center">
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            className={isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Terminer l'édition</>
            ) : (
              <><Edit2 className="w-4 h-4 mr-2" /> Éditer le plan</>
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
            const occupied = isTableOccupied(table.name);
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
                  <button 
                    className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 hover:scale-110 transition-all z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(table.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          
          {floorTables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <p className="text-lg">Aucune table dans cette salle</p>
              <p className="text-sm">Ajoutez-en via le bouton ci-dessous</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
