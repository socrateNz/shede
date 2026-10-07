import { NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/auth';

// Réécrit le cookie de session avec les modules actuels de la licence
// (getSession les relit en base). Appelé par l'interface quand la licence a
// changé depuis la connexion, pour que le middleware suive sans reconnexion.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.staleModules) return NextResponse.json({ refreshed: false });

  const { iat: _iat, exp: _exp, staleModules: _stale, ...payload } = session;
  await createSession(payload);
  return NextResponse.json({ refreshed: true });
}
