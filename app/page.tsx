import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(session.role === 'SUPER_ADMIN' ? '/structures' : '/dashboard');
  }

  redirect('/login');
}
