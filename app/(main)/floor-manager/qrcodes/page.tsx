import { getTables } from '@/app/actions/tables';
import { requireAuth } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { QRCodesClient } from './qrcodes-client';

export default async function QRCodesPage() {
  const session = await requireAuth();
  const tables = await getTables();

  const admin = getAdminSupabase();
  const { data: structure } = await admin
    .from('structures')
    .select('name')
    .eq('id', session.structureId!)
    .single();

  const structureName = structure?.name || 'Restaurant';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* Non-printable header */}
      <div className="max-w-5xl mx-auto mb-8 flex items-center justify-between print:hidden">
        <div>
          <Link href="/floor-manager" className="inline-flex items-center text-slate-500 hover:text-slate-800 mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour au plan de salle
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">QR Codes des tables</h1>
          <p className="text-slate-500">Imprimez cette page et placez les QR codes sur vos tables.</p>
        </div>
      </div>

      <QRCodesClient tables={tables} structureId={session.structureId!} structureName={structureName} />
    </div>
  );
}
