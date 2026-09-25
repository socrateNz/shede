'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { createTable } from '@/app/actions/tables';
import { toast } from 'sonner';
import type { Floor } from '@/lib/supabase';
import { useT } from '@/lib/i18n/client';

export function AddTableDialog({ floors }: { floors: Floor[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useT();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const result = await createTable(formData);
      if (result.success) {
        toast.success(t('floor.dialogs.tableCreated'));
        setOpen(false);
      } else {
        toast.error(result.error || t('floor.dialogs.tableCreateError'));
      }
    } catch (err: any) {
      toast.error(err.message || t('floor.dialogs.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <Plus className="w-4 h-4 mr-2" />
          {t('floor.dialogs.addTable')}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>{t('floor.dialogs.newTable')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm">{t('floor.dialogs.tableName')}</label>
            <Input name="name" required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">{t('floor.dialogs.capacity')}</label>
            <Input name="capacity" type="number" defaultValue={2} min={1} required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">{t('floor.dialogs.floor')}</label>
            <select name="floor_id" required defaultValue={floors[0]?.id} className="w-full bg-slate-900 border border-slate-600 rounded-md p-2">
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>{floor.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm">{t('floor.dialogs.shape')}</label>
            <select name="shape" className="w-full bg-slate-900 border border-slate-600 rounded-md p-2">
              <option value="rectangle">{t('floor.shapes.rectangle')}</option>
              <option value="round">{t('floor.shapes.round')}</option>
              <option value="square">{t('floor.shapes.square')}</option>
            </select>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? t('floor.dialogs.creating') : t('floor.dialogs.create')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
