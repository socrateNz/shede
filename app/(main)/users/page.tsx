import { requireRole } from '@/app/actions/auth';
import { getUsers } from '@/app/actions/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, UserCheck, UserCog, Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { UsersList } from '@/components/users-list';

async function getUsersStats(users: any[]) {
  const total = users.length;
  const admins = users.filter(user => user.role === 'ADMIN').length;
  const reception = users.filter(user => user.role === 'RECEPTION').length;
  const staff = users.filter(user => user.role === 'STAFF').length;

  return { total, admins, reception, staff };
}

export default async function UsersPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const users = await getUsers(session.structureId!);
  const stats = await getUsersStats(users);

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
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Gestion du personnel</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              Équipe
            </h1>
            <p className="text-slate-400">Gérez les membres de votre personnel</p>
          </div>
          <Link href="/users/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un membre
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-slate-400">Total membres</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-400">{stats.admins}</div>
                <div className="text-sm text-slate-400">Administrateurs</div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-emerald-400">{stats.reception}</div>
                <div className="text-sm text-slate-400">Réception</div>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <UserCheck className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-amber-400">{stats.staff}</div>
                <div className="text-sm text-slate-400">Personnel</div>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <UserCog className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Users List Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Membres de l'équipe ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <Users className="w-10 h-10 opacity-30" />
                </div>
                <p className="text-lg">Aucun membre dans l'équipe</p>
                <p className="text-sm mt-2 mb-6">Commencez par ajouter votre premier membre</p>
                <Link href="/users/new">
                  <Button variant="outline" className="border-slate-600 text-blue-400 hover:bg-slate-700 hover:text-blue-300">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un membre
                  </Button>
                </Link>
              </div>
            ) : (
              <UsersList users={users} />
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Les membres ont des accès différents selon leur rôle (Admin, Réception, Personnel)
          </p>
        </div>
      </div>
    </div>
  );
}