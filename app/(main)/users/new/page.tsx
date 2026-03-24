'use client';

import { createUser } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NewUserPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createUser, {
    success: false,
    error: '',
  });

  useEffect(() => {
    if (state.success) {
      router.push('/users');
    }
  }, [state.success, router]);

  return (
    <div className="p-8">
      <Link href="/users" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Team
      </Link>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Add Team Member</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">First Name *</label>
                <Input
                  type="text"
                  name="firstName"
                  placeholder="John"
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Last Name *</label>
                <Input
                  type="text"
                  name="lastName"
                  placeholder="Doe"
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Email *</label>
              <Input
                type="email"
                name="email"
                placeholder="john@example.com"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Password *</label>
              <Input
                type="password"
                name="password"
                placeholder="••••••••"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Role *</label>
              <select
                name="role"
                className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded-md px-3 py-2"
                defaultValue="SERVEUR"
                required
              >
                <option value="ADMIN">Admin</option>
                <option value="CAISSE">Cashier</option>
                <option value="SERVEUR">Waiter</option>
              </select>
            </div>

            {state.error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {state.error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? 'Creating...' : 'Add Member'}
              </Button>
              <Link href="/users">
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
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
