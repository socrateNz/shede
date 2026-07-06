import { hash, compare } from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const secretKey = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'default-secret-change-in-production'
);

/**
 * Rôles utilisateurs du système.
 * SUPER_ADMIN : accès global à toutes les structures.
 * ADMIN       : responsable d'un établissement.
 * MANAGER     : gestion opérationnelle (sans admin sensible).
 * CAISSE      : caissier/caissière.
 * SERVEUR     : prise de commandes en salle.
 * RECEPTION   : réception hôtel (chambres + réservations).
 * CUISINIER   : cuisine (Kitchen Display System).
 * BAR         : bar (Bar Display).
 * LIVREUR     : livraisons.
 * COMPTABLE   : comptabilité et rapports financiers.
 * MAGASINIER  : gestion des stocks.
 * RH          : ressources humaines.
 * CLIENT      : espace B2C (catalogue, panier, historique).
 */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'CAISSE'
  | 'SERVEUR'
  | 'RECEPTION'
  | 'CUISINIER'
  | 'BAR'
  | 'LIVREUR'
  | 'COMPTABLE'
  | 'MAGASINIER'
  | 'RH'
  | 'CLIENT';

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  structureId?: string;
  modules?: string[];
  /** Présent pour le staff rattaché à une structure (vérifié à la connexion). */
  licenseActive?: boolean;
  iat: number;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return compare(password, hash);
}

export async function createSession(payload: Omit<SessionPayload, 'iat' | 'exp'>) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return null;
    }

    const verified = await jwtVerify(token, secretKey);
    return verified.payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
