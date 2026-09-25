import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { requireRole } from '@/app/actions/auth';
import { createPoint } from '@/app/actions/organizations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PointForm } from '@/components/organization/point-form';

export default async function NewPointPage() {
  await requireRole('ORG_ADMIN');

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="w-full">
        <Link
          href="/organization/points"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux points</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Nouveau point</h1>
          <p className="text-slate-400">
            Le point aura accès à tous les modules de la licence de votre organisation.
          </p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-xl text-white flex items-center gap-3">
              <Building2 className="w-5 h-5 text-blue-400" />
              Point et administrateur
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <PointForm action={createPoint} withAdmin submitLabel="Créer le point" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
