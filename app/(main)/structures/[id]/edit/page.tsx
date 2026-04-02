import { requireRole } from '@/app/actions/auth';
import { updateStructure } from '@/app/actions/structures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default async function EditStructurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('SUPER_ADMIN');
  const { id: structureId } = await params;
  const admin = getAdminSupabase();

  const { data: structure } = await admin
    .from('structures')
    .select('*')
    .eq('id', structureId)
    .single();

  if (!structure) {
    return (
      <div className="p-8">
        <p className="text-red-400">Structure not found</p>
      </div>
    );
  }

  const selectedModules = Array.isArray(structure.modules) ? structure.modules : [];

  return (
    <div className="p-8">
      <Link href="/structures" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Structures
      </Link>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Edit Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              'use server';
              const result = await updateStructure(structureId, { success: false, error: '' }, formData);
              if (!result.success) {
                redirect(`/structures/${structureId}/edit?error=${result.error}`);
              }
              redirect('/structures');
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Structure Name *</label>
              <Input
                name="structureName"
                type="text"
                defaultValue={structure.name || ''}
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Structure Email *</label>
              <Input
                name="structureEmail"
                type="email"
                defaultValue={structure.email || ''}
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Lieu / Ville *</label>
              <Input
                name="city"
                type="text"
                defaultValue={structure.city || ''}
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Type de Structure *</label>
                <select
                  name="structureType"
                  defaultValue={structure.type || 'RESTAURANT'}
                  className="w-full bg-slate-700 border-slate-600 text-slate-50 rounded-md px-3 py-2 text-sm"
                  required
                >
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="HOTEL">Hôtel</option>
                  <option value="MIXTE">Mixte</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Modules (Maintenez Ctrl pour plusieurs)</label>
                <select
                  name="modules"
                  multiple
                  defaultValue={selectedModules}
                  className="w-full bg-slate-700 border-slate-600 text-slate-50 rounded-md px-3 py-2 text-sm h-20"
                >
                  <option value="POS">Caisse (POS)</option>
                  <option value="HOTEL">Hôtel (Chambres)</option>
                  <option value="CLIENT_APP">Application Client (B2C)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Save Changes
              </Button>
              <Link href="/structures">
                <Button type="button" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
