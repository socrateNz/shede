import { requireAuth } from '@/app/actions/auth';
import { MainShell } from '@/components/main-shell';
import { getAdminSupabase } from '@/lib/supabase';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth();

  let structure = null;
  if (session.structureId) {
    const admin = getAdminSupabase();
    const { data } = await admin.from('structures').select('*').eq('id', session.structureId).single();
    structure = data;
  }

  return <MainShell session={session} structure={structure}>{children}</MainShell>;
}
