'use client';

import { createStructureWithAdmin } from '@/app/actions/structures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewStructurePage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createStructureWithAdmin, {
    success: false,
    error: '',
  });

  useEffect(() => {
    if (state.success) {
      router.push('/structures');
    }
  }, [state.success, router]);

  return (
    <div className="p-8">
      <Link href="/structures" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Structures
      </Link>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Create Structure + Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Structure Name *</label>
              <Input
                name="structureName"
                type="text"
                placeholder="Restaurant Lumiere"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Structure Email *</label>
              <Input
                name="structureEmail"
                type="email"
                placeholder="contact@restaurant.com"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Admin First Name *</label>
                <Input
                  name="adminFirstName"
                  type="text"
                  placeholder="John"
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Admin Last Name *</label>
                <Input
                  name="adminLastName"
                  type="text"
                  placeholder="Doe"
                  className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Admin Email *</label>
              <Input
                name="adminEmail"
                type="email"
                placeholder="admin@restaurant.com"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Admin Password *</label>
              <Input
                name="adminPassword"
                type="password"
                placeholder="Minimum 8 characters"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
                minLength={8}
              />
            </div>

            {state.error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {state.error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isPending ? 'Creating...' : 'Create Structure'}
              </Button>
              <Link href="/structures">
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
