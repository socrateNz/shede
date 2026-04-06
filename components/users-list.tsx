'use client';

import { User } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, MoreVertical, Shield, UserCheck, UserCog, CreditCard, Coffee, Mail, Calendar, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
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
import { deleteUser } from '@/app/actions/users';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TablePagination } from './table-pagination';

interface UsersListProps {
  users: User[];
}

const roleConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
  ADMIN: { label: 'Administrateur', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  CAISSE: { label: 'Caisse', icon: CreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  SERVEUR: { label: 'Serveur', icon: Coffee, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  RECEPTION: { label: 'Réception', icon: UserCheck, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  STAFF: { label: 'Personnel', icon: UserCog, color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

export function UsersList({ users }: UsersListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(users.length / itemsPerPage);
  const paginatedUsers = users.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;

    setDeletingId(userId);
    const result = await deleteUser(userId);
    setDeletingId(null);

    if (result.success) {
      toast.success('Utilisateur supprimé avec succès');
      router.refresh();
    } else {
      toast.error(result.error || 'Erreur lors de la suppression');
    }
  };

  const getRoleConfig = (role: string) => {
    return roleConfig[role] || { label: role, icon: UserCog, color: 'text-slate-400', bg: 'bg-slate-500/10' };
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800/50">
            <TableHead className="text-slate-300 font-semibold">Nom</TableHead>
            <TableHead className="text-slate-300 font-semibold">Email</TableHead>
            <TableHead className="text-slate-300 font-semibold">Rôle</TableHead>
            <TableHead className="text-slate-300 font-semibold">Statut</TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedUsers.map((user) => {
            const role = getRoleConfig(user.role);
            const RoleIcon = role.icon;
            const isSuperAdmin = user.role === 'SUPER_ADMIN';

            return (
              <TableRow
                key={user.id}
                className="border-slate-700 hover:bg-slate-800/50 transition-colors group"
              >
                <TableCell className="text-slate-50 font-medium">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-400">
                        {getInitials(user.first_name!, user.last_name!)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-50">
                        {user.first_name} {user.last_name}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${role.bg} ${role.color}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    {role.label}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.is_active
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                      }`}
                  >
                    {user.is_active ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Actif
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        Inactif
                      </>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {!isSuperAdmin ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-40 bg-slate-800 border-slate-700 text-slate-200"
                      >
                        <Link href={`/users/${user.id}`}>
                          <DropdownMenuItem className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2">
                            <Edit2 className="w-4 h-4 text-blue-400" />
                            <span>Modifier</span>
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem
                          onClick={() => handleDelete(user.id)}
                          disabled={deletingId === user.id}
                          className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-red-400"
                        >
                          {deletingId === user.id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span>Supprimer</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-xs text-slate-500 px-2 py-1 rounded-lg bg-red-500/10 text-red-400">
                      <Shield className="w-3 h-3 inline mr-1" />
                      Super Admin
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}