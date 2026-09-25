'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { createFloor } from '@/app/actions/floors';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

export function AddFloorDialog({ onCreated }: { onCreated: (floor: any) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const { t } = useT();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createFloor(name);
      if (result.success) {
        toast.success(t('floor.dialogs.floorCreated'));
        onCreated(result.floor);
        setName('');
        setOpen(false);
      } else {
        toast.error(result.error || t('floor.dialogs.floorCreateError'));
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
        <Button
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          {t('floor.dialogs.newFloor')}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>{t('floor.dialogs.newFloor')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm">{t('floor.dialogs.floorName')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-900 border-slate-600"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? t('floor.dialogs.creating') : t('floor.dialogs.create')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
