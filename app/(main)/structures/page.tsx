import { requireRole } from '@/app/actions/auth';
import { getAllStructures, updateStructureLicense } from '@/app/actions/structures';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Building2, Plus, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function toLocalDateTimeInput(isoDate?: string | null) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default async function StructuresPage() {
  await requireRole('SUPER_ADMIN');
  const structures = await getAllStructures();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Structures</h1>
          <p className="text-slate-400">Manage all restaurant tenants</p>
        </div>
        <Link href="/structures/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Structure
          </Button>
        </Link>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">All Structures ({structures.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {structures.length === 0 ? (
            <div className="text-slate-400 py-8">No structures yet.</div>
          ) : (
            <div className="space-y-3">
              {structures.map((structure: any) => (
                <div key={structure.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-blue-500/10">
                        <Building2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-slate-50 font-medium">{structure.name}</p>
                        <p className="text-slate-400 text-sm">{structure.email}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{new Date(structure.created_at).toLocaleDateString()}</p>
                  </div>

                  <form
                    action={async (formData) => {
                      'use server';
                      const { updateStructureLicense } = await import('@/app/actions/structures');
                      await updateStructureLicense(structure.id, { success: false, error: '' }, formData);
                    }}
                    className="grid md:grid-cols-3 gap-3 items-end"
                  >
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Licence active</label>
                      <select
                        name="isActive"
                        defaultValue={
                          String(Array.isArray(structure.licenses) ? structure.licenses[0]?.is_active : structure.licenses?.is_active)
                        }
                        className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="true">Active</option>
                        <option value="false">Désactivée</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Expiration licence</label>
                      <input
                        type="datetime-local"
                        name="expiresAt"
                        defaultValue={toLocalDateTimeInput(
                          Array.isArray(structure.licenses)
                            ? structure.licenses[0]?.expires_at
                            : structure.licenses?.expires_at
                        )}
                        className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                       <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
                         Update
                       </Button>
                    </div>
                  </form>
                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-slate-600 text-blue-400 hover:bg-slate-700">
                          <Eye className="w-4 h-4 mr-2" />
                          Voir
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl h-[85vh] p-0 bg-slate-900 border-slate-700 sm:max-w-5xl">
                        <DialogTitle className="sr-only">Aperçu de la structure</DialogTitle>
                        <iframe src={`/structures/${structure.id}`} className="w-full h-full rounded-md border-0 bg-white" />
                      </DialogContent>
                    </Dialog>
                    <Link href={`/structures/${structure.id}/edit`}>
                      <Button variant="outline" size="sm" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                        Edit
                      </Button>
                    </Link>
                    <form action={async () => {
                      'use server';
                      const { deleteStructure } = await import('@/app/actions/structures');
                      await deleteStructure(structure.id);
                    }}>
                       <Button type="submit" variant="destructive" size="sm" className="bg-red-900/40 text-red-400 hover:bg-red-900/60 hover:text-red-300">
                         Delete
                       </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
