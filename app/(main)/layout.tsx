import { requireAuth } from '@/app/actions/auth';
import { MainShell } from '@/components/main-shell';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth();

  if (session.role === 'CLIENT') {
    redirect('/client');
  }

  let structure = null;
  if (session.structureId) {
    const admin = getAdminSupabase();
    const { data } = await admin.from('structures').select('*').eq('id', session.structureId).single();
    structure = data;
  }

  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return <MainShell session={session} structure={structure} initialTheme={theme}>{children}</MainShell>;
}
