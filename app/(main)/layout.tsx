import { requireAuth } from '@/app/actions/auth';
import { MainShell } from '@/components/main-shell';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth();

  return <MainShell session={session}>{children}</MainShell>;
}
