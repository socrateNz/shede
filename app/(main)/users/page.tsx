import { requireRole } from '@/app/actions/auth';
import { getUsers } from '@/app/actions/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { UsersList } from '@/components/users-list';

export default async function UsersPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const users = await getUsers(session.structureId);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Team Members</h1>
          <p className="text-slate-400">Manage your restaurant staff</p>
        </div>
        <Link href="/users/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </Link>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No team members yet</p>
            </div>
          ) : (
            <UsersList users={users} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
