'use client';

import { createRoom } from '@/app/actions/rooms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requireRole } from '@/app/actions/auth';

export default function NewRoomPage() {
  requireRole('ADMIN', 'SUPER_ADMIN', 'RECEPTION');
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createRoom, {
    success: false,
    error: '',
  });

  useEffect(() => {
    if (state.success) {
      router.push('/rooms');
    }
  }, [state.success, router]);

  return (
    <div className="p-8">
      <Link href="/rooms" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Retour aux chambres
      </Link>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Ajouter une Chambre</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Numéro de Chambre *</label>
              <Input
                name="roomNumber"
                type="text"
                placeholder="Ex: 101"
                className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Type de Chambre (Optionnel)</label>
              <select
                name="roomType"
                defaultValue="Standard"
                className="flex h-10 w-full rounded-md border bg-slate-700 border-slate-600 px-3 py-2 text-sm text-slate-50 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Standard">Standard</option>
                <option value="Double">Double</option>
                <option value="Studio">Studio</option>
                <option value="Suite">Suite</option>
                <option value="Familiale">Familiale</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            {state.error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {state.error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isPending ? 'Création...' : 'Créer'}
              </Button>
              <Link href="/rooms">
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                  Annuler
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
