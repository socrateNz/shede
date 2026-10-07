import { hash, compare } from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getAdminSupabase } from '@/lib/supabase';

const secretKey = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'default-secret-change-in-production'
);

/**
 * Rôles utilisateurs du système.
 * SUPER_ADMIN : accès global à toutes les organisations.
 * ORG_ADMIN   : administrateur d'une organisation (crée les points et leurs admins).
 * ADMIN       : administrateur d'un point (gère son point de façon indépendante).
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
  | 'ORG_ADMIN'
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
  /** Point auquel est rattaché le staff (absent pour ORG_ADMIN / SUPER_ADMIN / CLIENT). */
  structureId?: string;
  /** Organisation propriétaire de la licence (ORG_ADMIN et staff des points). */
  organizationId?: string;
  modules?: string[];
  /** Présent pour les comptes rattachés à une organisation (vérifié à la connexion). */
  licenseActive?: boolean;
  /**
   * Modules inscrits dans le cookie (figés à la connexion), quand ils diffèrent
   * de la licence actuelle : le cookie doit être réécrit (voir /api/session/refresh).
   * Jamais signé dans le jeton.
   */
  staleModules?: string[];
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
    const session = verified.payload as unknown as SessionPayload;

    // Modules à jour : la licence peut avoir changé depuis la connexion.
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'CLIENT') {
      const current = await loadCurrentModules(session.organizationId ?? null, session.structureId ?? null);
      if (current) {
        if (!sameModules(current, session.modules ?? [])) session.staleModules = session.modules ?? [];
        session.modules = current;
      }
    }
    return session;
  } catch (error) {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

function sameModules(a: string[], b: string[]) {
  return a.length === b.length && a.every((m) => b.includes(m));
}

/**
 * Modules actuels de la licence de l'organisation (structures.modules en repli,
 * comme à la connexion). Une seule lecture par requête ; null si la base ne
 * répond pas (on garde alors ceux du cookie).
 */
const loadCurrentModules = cache(async (organizationId: string | null, structureId: string | null): Promise<string[] | null> => {
  try {
    const admin = getAdminSupabase();
    let orgId = organizationId;
    let pointModules: string[] | null = null;
    if (structureId) {
      const { data: point } = await admin.from('structures').select('organization_id, modules').eq('id', structureId).maybeSingle();
      orgId = orgId ?? ((point?.organization_id as string | null) ?? null);
      pointModules = (point?.modules as string[] | null) ?? null;
    }
    if (orgId) {
      const { data: organization } = await admin.from('organizations').select('modules').eq('id', orgId).maybeSingle();
      if (organization?.modules) return organization.modules as string[];
    }
    return pointModules;
  } catch {
    return null;
  }
});
