'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { createTable } from '@/app/actions/tables';
import { toast } from 'sonner';

export function AddTableDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const result = await createTable(formData);
      if (result.success) {
        toast.success('Table ajoutée avec succès');
        setOpen(false);
      } else {
        toast.error(result.error || 'Erreur lors de la création de la table');
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
        <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une table
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>Nouvelle Table</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm">Nom de la table (ex: T1)</label>
            <Input name="name" required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Capacité (personnes)</label>
            <Input name="capacity" type="number" defaultValue={2} min={1} required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Salle / Zone</label>
            <Input name="floor_name" defaultValue="Salle principale" required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Forme</label>
            <select name="shape" className="w-full bg-slate-900 border border-slate-600 rounded-md p-2">
              <option value="rectangle">Rectangle</option>
              <option value="round">Ronde</option>
              <option value="square">Carrée</option>
            </select>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? 'Création...' : 'Créer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
