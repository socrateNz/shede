'use client';

import { getAccompaniments, createAccompaniment, updateAccompaniment, deleteAccompaniment } from '@/app/actions/accompaniments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Trash2, Check, X, Package, DollarSign, Tag } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
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
import { TablePagination } from '@/components/table-pagination';

export default function AccompanimentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: 0, is_available: true });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

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
  }, [state.success]);

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

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const availableCount = items.filter(item => item.is_available).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
              <Package className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Gestion des extras</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              Accompagnements
            </h1>
            <p className="text-slate-400">Gérez les extras et options de votre menu</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{items.length}</div>
                <div className="text-sm text-slate-400">Total accompagnements</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-400">{availableCount}</div>
                <div className="text-sm text-slate-400">Disponibles</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Tag className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-400">{totalPrice.toFixed(2)} FCFA</div>
                <div className="text-sm text-slate-400">Valeur totale</div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <DollarSign className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Creation Form */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl h-fit overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-slate-50 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                Nouvel accompagnement
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form action={formAction} className="space-y-5">
                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-400" />
                    Nom de l'accompagnement *
                  </label>
                  <Input
                    name="name"
                    required
                    placeholder="Ex: Frites, Salade, Sauce..."
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                  />
                </div>
                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-purple-400" />
                    Prix *
                  </label>
                  <Input
                    name="price"
                    type="number"
                    step="10"
                    min="0"
                    required
                    placeholder="Ex: 500"
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Prix en FCFA</p>
                </div>
                {state.error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                      {state.error}
                    </div>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Création en cours...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Créer l'accompagnement
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl lg:col-span-2 overflow-hidden">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-slate-50 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                Liste des accompagnements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-slate-400">Chargement...</p>
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Aucun accompagnement</p>
                  <p className="text-sm mt-2">Commencez par créer un nouvel accompagnement</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-300 font-semibold">Nom</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Prix</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Disponibilité</TableHead>
                        <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map(item => (
                        <TableRow
                          key={item.id}
                          className="border-slate-700 hover:bg-slate-800/50 transition-colors group"
                        >
                          {editingId === item.id ? (
                            <>
                              <TableCell>
                                <Input
                                  value={editForm.name}
                                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                  className="h-8 bg-slate-700 border-slate-600 text-slate-50 focus:border-blue-500"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="10"
                                  value={editForm.price}
                                  onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                                  className="h-8 bg-slate-700 border-slate-600 text-slate-50 w-28 focus:border-purple-500"
                                />
                              </TableCell>
                              <TableCell>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editForm.is_available}
                                    onChange={e => setEditForm({ ...editForm, is_available: e.target.checked })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={handleUpdate}
                                    className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditingId(null)}
                                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="font-medium text-slate-200">
                                {item.name}
                              </TableCell>
                              <TableCell className="text-slate-300">
                                <span className="font-semibold text-white">{item.price.toLocaleString()} FCFA</span>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.is_available
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-red-500/10 text-red-400'
                                  }`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${item.is_available ? 'bg-green-400' : 'bg-red-400'}`} />
                                  {item.is_available ? 'Disponible' : 'Indisponible'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                                    >
                                      <span className="sr-only">Menu actions</span>
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                      </svg>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-48 bg-slate-800 border-slate-700 text-slate-200"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => handleEditInit(item)}
                                      className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700"
                                    >
                                      <Edit2 className="w-4 h-4 mr-2 text-blue-400" />
                                      <span>Modifier</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-slate-700" />
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(item.id)}
                                      className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 text-red-400"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      <span>Supprimer</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer avec information */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Les accompagnements sont automatiquement disponibles dans le menu de commande
          </p>
        </div>
      </div>
    </div>
  );
}