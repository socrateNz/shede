import { jwtVerify } from 'jose';
import type { SessionPayload } from '@/lib/auth';

const secretKey = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'default-secret-change-in-production'
);

/** Lecture de session depuis les cookies de la requête (Edge / middleware). */
export async function getSessionFromRequest(
  request: Request
): Promise<SessionPayload | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const sessionCookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('session='));

  if (!sessionCookie) return null;

  const token = sessionCookie.slice('session='.length);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function hasModule(session: SessionPayload, moduleName: string): boolean {
  if (session.role === 'SUPER_ADMIN') return true;
  return Boolean(session.modules?.includes(moduleName));
}
