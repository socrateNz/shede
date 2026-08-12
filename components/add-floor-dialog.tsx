'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { createFloor } from '@/app/actions/floors';
import { toast } from 'sonner';

export function AddFloorDialog({ onCreated }: { onCreated: (floor: any) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createFloor(name);
      if (result.success) {
        toast.success('Salle créée avec succès');
        onCreated(result.floor);
        setName('');
        setOpen(false);
      } else {
        toast.error(result.error || 'Erreur lors de la création de la salle');
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
        <Button
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Nouvelle salle
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>Nouvelle Salle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm">Nom de la salle (ex: Terrasse)</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-900 border-slate-600"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? 'Création...' : 'Créer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
