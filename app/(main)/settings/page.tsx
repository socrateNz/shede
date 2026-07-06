import { requireAuth } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { SettingsPageClient } from './settings-client';

export const metadata = {
  title: 'Paramètres — Shede',
  description: 'Paramètres de votre établissement',
};

export default async function SettingsPage() {
  const session = await requireAuth();

  let structure = null;
  if (session.structureId) {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('structures')
      .select('*')
      .eq('id', session.structureId)
      .single();
    structure = data;
  }

  return <SettingsPageClient session={session} structure={structure} />;
}
