import { requireRole } from '@/app/actions/auth';
import { getAllStructures, updateStructureLicense } from '@/app/actions/structures';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Building2, Plus, Eye, Edit2, Trash2, Calendar, CheckCircle, XCircle, MoreVertical, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function toLocalDateTimeInput(isoDate?: string | null) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getLicenseStatus(expiresAt: string | null) {
  if (!expiresAt) return { status: 'inactive', label: 'Non définie', color: 'text-slate-400', bg: 'bg-slate-500/10' };

  const now = new Date();
  const expiry = new Date(expiresAt);

  if (expiry < now) {
    return { status: 'expired', label: 'Expirée', color: 'text-red-400', bg: 'bg-red-500/10' };
  }

  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 7) {
    return { status: 'warning', label: `Expire dans ${daysLeft}j`, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  }

  return { status: 'active', label: `Valable jusqu'au ${expiry.toLocaleDateString('fr-FR')}`, color: 'text-green-400', bg: 'bg-green-500/10' };
}

async function getStructuresStats(structures: any[]) {
  const total = structures.length;
  const active = structures.filter(s => {
    const license = Array.isArray(s.licenses) ? s.licenses[0] : s.licenses;
    return license?.is_active === true;
  }).length;
  const expiringSoon = structures.filter(s => {
    const license = Array.isArray(s.licenses) ? s.licenses[0] : s.licenses;
    if (!license?.expires_at) return false;
    const daysLeft = Math.ceil((new Date(license.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7 && daysLeft > 0;
  }).length;

  return { total, active, expiringSoon };
}

export default async function StructuresPage() {
  await requireRole('SUPER_ADMIN');
  const structures = await getAllStructures();
  const stats = await getStructuresStats(structures);

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
              <Building2 className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Gestion des établissements</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              Structures
            </h1>
            <p className="text-slate-400">Gérez tous les établissements partenaires</p>
          </div>
          <Link href="/structures/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle structure
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-slate-400">Total structures</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.active}</div>
                <div className="text-sm text-slate-400">Actives</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-400">{stats.expiringSoon}</div>
                <div className="text-sm text-slate-400">Expiration proche</div>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Structures List Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Toutes les structures ({structures.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {structures.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <Building2 className="w-10 h-10 opacity-30" />
                </div>
                <p className="text-lg">Aucune structure</p>
                <p className="text-sm mt-2 mb-6">Commencez par créer votre première structure</p>
                <Link href="/structures/new">
                  <Button variant="outline" className="border-slate-600 text-blue-400 hover:bg-slate-700 hover:text-blue-300">
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle structure
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {structures.map((structure: any) => {
                  const license = Array.isArray(structure.licenses) ? structure.licenses[0] : structure.licenses;
                  const isActive = license?.is_active === true;
                  const licenseStatus = getLicenseStatus(license?.expires_at);

                  return (
                    <div key={structure.id} className="p-6 hover:bg-slate-800/30 transition-all duration-300">
                      {/* En-tête de la structure */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                            <Building2 className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-slate-50 font-semibold text-lg">{structure.name}</h3>
                            <p className="text-slate-400 text-sm">{structure.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                          <p className="text-xs text-slate-500">
                            Créée le {new Date(structure.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>

                      {/* Formulaire licence */}
                      <form
                        action={async (formData) => {
                          'use server';
                          const { updateStructureLicense } = await import('@/app/actions/structures');
                          await updateStructureLicense(structure.id, { success: false, error: '' }, formData);
                        }}
                        className="grid md:grid-cols-3 gap-4 mb-4"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Statut licence
                          </label>
                          <select
                            name="isActive"
                            defaultValue={String(isActive)}
                            className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 cursor-pointer"
                          >
                            <option value="true">✓ Active</option>
                            <option value="false">✗ Désactivée</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expiration licence
                          </label>
                          <input
                            type="datetime-local"
                            name="expiresAt"
                            defaultValue={toLocalDateTimeInput(license?.expires_at)}
                            className="w-full bg-slate-900/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                          />
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                          >
                            Mettre à jour
                          </Button>
                        </div>
                      </form>

                      {/* Statut licence */}
                      {license?.expires_at && (
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${licenseStatus.bg} ${licenseStatus.color} mb-4`}>
                          <Calendar className="w-3 h-3" />
                          {licenseStatus.label}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-slate-600 text-blue-400 hover:bg-slate-700 hover:text-blue-300"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Aperçu
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-5xl h-[85vh] p-0 bg-slate-900 border-slate-700 sm:max-w-5xl">
                            <DialogTitle className="sr-only">Aperçu de la structure</DialogTitle>
                            <iframe src={`/structures/${structure.id}`} className="w-full h-full rounded-md border-0 bg-white" />
                          </DialogContent>
                        </Dialog>

                        <Link href={`/structures/${structure.id}/edit`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Modifier
                          </Button>
                        </Link>

                        <form action={async () => {
                          'use server';
                          const { deleteStructure } = await import('@/app/actions/structures');
                          await deleteStructure(structure.id);
                        }}>
                          <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            className="bg-red-900/40 text-red-400 hover:bg-red-900/60 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </Button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Seul un Super Administrateur peut gérer les structures et leurs licences
          </p>
        </div>
      </div>
    </div>
  );
}