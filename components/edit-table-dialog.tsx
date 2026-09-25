'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil } from 'lucide-react';
import { updateTable } from '@/app/actions/tables';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

interface TableData {
  id: string;
  name: string;
  capacity: number;
  shape: 'round' | 'square' | 'rectangle';
}

export function EditTableDialog({ table, onUpdated }: { table: TableData; onUpdated: (table: any) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useT();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result = await updateTable(table.id, formData);
      if (result.success) {
        toast.success(t('floor.dialogs.tableUpdated'));
        onUpdated(result.table);
        setOpen(false);
      } else {
        toast.error(result.error || t('floor.dialogs.tableUpdateError'));
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
        <button
          className="absolute -top-3 -left-3 w-6 h-6 bg-slate-700 text-white rounded-full flex items-center justify-center hover:bg-slate-600 hover:scale-110 transition-all z-20"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title={t('floor.manager.editTable')}
          aria-label={t('floor.manager.editTable')}
        >
          <Pencil className="w-3 h-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>{t('floor.dialogs.editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm">{t('floor.dialogs.tableNameEdit')}</label>
            <Input name="name" defaultValue={table.name} required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">{t('floor.dialogs.capacity')}</label>
            <Input name="capacity" type="number" defaultValue={table.capacity} min={1} required className="bg-slate-900 border-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-sm">{t('floor.dialogs.shape')}</label>
            <select name="shape" defaultValue={table.shape} className="w-full bg-slate-900 border border-slate-600 rounded-md p-2">
              <option value="rectangle">{t('floor.shapes.rectangle')}</option>
              <option value="round">{t('floor.shapes.round')}</option>
              <option value="square">{t('floor.shapes.square')}</option>
            </select>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? t('floor.dialogs.updating') : t('floor.dialogs.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
