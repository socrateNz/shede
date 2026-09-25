import { requireAuth } from '@/app/actions/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { SettingsPageClient } from './settings-client';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('settings.meta.title'), description: t('settings.meta.description') };
}

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
