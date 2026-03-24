import { requireAuth } from '@/app/actions/auth';
import { Sidebar } from '@/components/sidebar';
import { TopNav } from '@/components/top-nav';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth();

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar session={session} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopNav session={session} />
        <div className="flex-1 overflow-auto bg-slate-900">
          {children}
        </div>
      </main>
    </div>
  )
}
