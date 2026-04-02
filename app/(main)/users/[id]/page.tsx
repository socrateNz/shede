import { requireRole } from '@/app/actions/auth';
import { updateUser } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const { id: userId } = await params;
  const admin = getAdminSupabase();

  const { data: user } = await admin
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('structure_id', session.structureId)
    .single();

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-red-400">User not found</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link href="/users" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Team
      </Link>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Edit Team Member</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              'use server';
              const result = await updateUser(
                userId,
                String(formData.get('firstName') || ''),
                String(formData.get('lastName') || ''),
                String(formData.get('role') || ''),
                formData.get('isActive') === 'on'
              );

              if (!result.success) {
                redirect(`/users/${userId}`);
              }

              redirect('/users');
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">First Name *</label>
                <Input
                  type="text"
                  name="firstName"
                  defaultValue={user.first_name || ''}
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Last Name *</label>
                <Input
                  type="text"
                  name="lastName"
                  defaultValue={user.last_name || ''}
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Email</label>
              <Input
                type="email"
                value={user.email}
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                disabled
              />
              <p className="text-xs text-slate-400">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Role *</label>
              <select
                name="role"
                defaultValue={user.role}
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded-md px-3 py-2"
                required
              >
                <option value="ADMIN">Admin</option>
                <option value="CAISSE">Cashier</option>
                <option value="SERVEUR">Waiter</option>
                <option value="RECEPTION">Reception</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={user.is_active}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium text-slate-200">User is active</label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Save Changes
              </Button>
              <Link href="/users">
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
