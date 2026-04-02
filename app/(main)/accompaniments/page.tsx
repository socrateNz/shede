'use client';

import { getAccompaniments, createAccompaniment, updateAccompaniment, deleteAccompaniment } from '@/app/actions/accompaniments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function AccompanimentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: 0, is_available: true });

  const [state, formAction, isPending] = useActionState(createAccompaniment, {
    success: false,
    error: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const data = await getAccompaniments();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [state.success]); // Refetch on create

  const handleEditInit = (item: any) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, price: item.price, is_available: item.is_available });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const res = await updateAccompaniment(editingId, editForm.name, editForm.price, editForm.is_available);
    if (res.success) {
      setEditingId(null);
      fetchData();
    } else {
       alert(res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cet accompagnement ?')) return;
    const res = await deleteAccompaniment(id);
    if (!res.success) alert(res.error);
    else fetchData();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Accompagnements</h1>
          <p className="text-slate-400">Gérez les extras et options de votre menu</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Creation Form */}
        <Card className="bg-slate-800 border-slate-700 md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-slate-50">Nouvel Accompagnement</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Nom</label>
                <Input name="name" required placeholder="Ex: Frites" className="bg-slate-700 border-slate-600 text-slate-50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Prix ($)</label>
                <Input name="price" type="number" step="0.01" min="0" required placeholder="Ex: 2.50" className="bg-slate-700 border-slate-600 text-slate-50" />
              </div>
              {state.error && <p className="text-sm text-red-400">{state.error}</p>}
              <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {isPending ? 'Création...' : 'Créer'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="bg-slate-800 border-slate-700 md:col-span-2">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Chargement...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Aucun accompagnement.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-800">
                    <TableHead className="text-slate-300">Nom</TableHead>
                    <TableHead className="text-slate-300">Prix</TableHead>
                    <TableHead className="text-slate-300">Dispo</TableHead>
                    <TableHead className="text-slate-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id} className="border-slate-700">
                      {editingId === item.id ? (
                        <>
                          <TableCell><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="h-8 bg-slate-700 border-slate-600 text-slate-50" /></TableCell>
                          <TableCell><Input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm({...editForm, price: parseFloat(e.target.value)})} className="h-8 bg-slate-700 border-slate-600 text-slate-50 w-24" /></TableCell>
                          <TableCell><input type="checkbox" checked={editForm.is_available} onChange={e => setEditForm({...editForm, is_available: e.target.checked})} className="w-4 h-4 cursor-pointer" /></TableCell>
                          <TableCell className="text-right space-x-2">
                             <Button size="icon" variant="ghost" className="text-green-400" onClick={handleUpdate}><Check className="w-4 h-4" /></Button>
                             <Button size="icon" variant="ghost" className="text-slate-400" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-slate-50">{item.name}</TableCell>
                          <TableCell className="text-slate-400">${item.price.toFixed(2)}</TableCell>
                          <TableCell><span className={`px-2 py-0.5 text-xs rounded-full ${item.is_available ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{item.is_available ? 'Oui' : 'Non'}</span></TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="icon" variant="ghost" onClick={() => handleEditInit(item)} className="text-slate-400 hover:text-slate-200"><Edit2 className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
