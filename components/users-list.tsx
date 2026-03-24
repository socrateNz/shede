'use client';

import { User } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { deleteUser } from '@/app/actions/users';
import { useState } from 'react';

interface UsersListProps {
  users: User[];
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-500/10 text-red-400',
  ADMIN: 'bg-purple-500/10 text-purple-400',
  CAISSE: 'bg-blue-500/10 text-blue-400',
  SERVEUR: 'bg-green-500/10 text-green-400',
};

export function UsersList({ users }: UsersListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    setDeletingId(userId);
    const result = await deleteUser(userId);
    setDeletingId(null);

    if (result.success) {
      window.location.reload();
    } else {
      alert(result.error);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-700 hover:bg-slate-800">
          <TableHead className="text-slate-300">Name</TableHead>
          <TableHead className="text-slate-300">Email</TableHead>
          <TableHead className="text-slate-300">Role</TableHead>
          <TableHead className="text-slate-300">Status</TableHead>
          <TableHead className="text-slate-300 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id} className="border-slate-700 hover:bg-slate-700/50">
            <TableCell className="text-slate-50 font-medium">
              {user.first_name} {user.last_name}
            </TableCell>
            <TableCell className="text-slate-400">{user.email}</TableCell>
            <TableCell>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] || 'bg-slate-700 text-slate-300'}`}>
                {user.role}
              </span>
            </TableCell>
            <TableCell>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.is_active
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Link href={`/users/${user.id}`}>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
                  <Edit2 className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(user.id)}
                disabled={deletingId === user.id}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
