'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil } from 'lucide-react';
import { updateTable } from '@/app/actions/tables';
import { toast } from 'sonner';

interface TableData {
  id: string;
  name: string;
  capacity: number;
  shape: 'round' | 'square' | 'rectangle';
}

export function EditTableDialog({ table, onUpdated }: { table: TableData; onUpdated: (table: any) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result = await updateTable(table.id, formData);
      if (result.success) {
        toast.success('Table mise à jour');
        onUpdated(result.table);
        setOpen(false);
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="absolute -top-3 -left-3 w-6 h-6 bg-slate-700 text-white rounded-full flex items-center justify-center hover:bg-slate-600 hover:scale-110 transition-all z-20"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="Modifier la table"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>Modifier la Table</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm">Nom de la table</label>
            <Input name="name" defaultValue={table.name} required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Capacité (personnes)</label>
            <Input name="capacity" type="number" defaultValue={table.capacity} min={1} required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Forme</label>
            <select name="shape" defaultValue={table.shape} className="w-full bg-slate-900 border border-slate-600 rounded-md p-2">
              <option value="rectangle">Rectangle</option>
              <option value="round">Ronde</option>
              <option value="square">Carrée</option>
            </select>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? 'Mise à jour...' : 'Enregistrer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
