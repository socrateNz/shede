import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SessionPayload } from '@/lib/auth';
import { getSessionFromRequest, hasModule } from '@/lib/auth-session';

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CAISSE', 'SERVEUR', 'RECEPTION'] as const;

/** Chemins accessibles sans connexion */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/register-client',
  '/register-business',
  '/docs',
  '/unauthorized',
  '/cart',
]);

/** Préfixes publics (catalogue B2C, assets) */
const PUBLIC_PREFIXES = [
  '/client/structure',
  '/_next',
  '/api/setup',
];

/** Espace client connecté */
const CLIENT_PREFIXES = ['/client', '/history'];

/** Back-office staff */
const STAFF_PREFIXES = [
  '/dashboard',
  '/orders',
  '/products',
  '/users',
  '/structures',
  '/stock',
  '/rooms',
  '/bookings',
  '/promotions',
  '/accompaniments',
  '/notifications',
  '/settings',
  '/statistics',
  '/shifts',
];

type RouteRule = {
  prefix: string;
  roles: readonly string[];
  modules?: string[];
};

const ROUTE_RULES: RouteRule[] = [
  { prefix: '/structures', roles: ['SUPER_ADMIN'] },
  { prefix: '/users', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { prefix: '/products', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { prefix: '/statistics', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { prefix: '/shifts', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { prefix: '/accompaniments', roles: ['ADMIN'] },
  { prefix: '/orders', roles: ['ADMIN', 'CAISSE', 'SERVEUR'] },
  { prefix: '/bookings', roles: ['ADMIN', 'RECEPTION'], modules: ['HOTEL'] },
  { prefix: '/rooms', roles: ['ADMIN', 'RECEPTION'], modules: ['HOTEL'] },
  { prefix: '/stock', roles: ['ADMIN'], modules: ['STOCK'] },
  { prefix: '/promotions', roles: ['ADMIN'], modules: ['PROMOTION'] },
];

const AUTH_ONLY_PATHS = new Set(['/login', '/register-client', '/register-business']);

function isStaticAsset(pathname: string): boolean {
  return /\.(webp|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|css|js|map)$/i.test(pathname);
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (isStaticAsset(pathname)) return true;
  return false;
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function getStaffHome(session: SessionPayload): string {
  if (session.role === 'SUPER_ADMIN') return '/structures';
  if (session.role === 'CLIENT') return '/client';
  return '/dashboard';
}

function checkRouteRule(
  pathname: string,
  session: SessionPayload
): NextResponse | null {
  if (session.role === 'SUPER_ADMIN') return null;

  for (const rule of ROUTE_RULES) {
    if (pathname !== rule.prefix && !pathname.startsWith(`${rule.prefix}/`)) {
      continue;
    }
    if (!rule.roles.includes(session.role)) {
      return NextResponse.redirect(new URL('/unauthorized', pathname));
    }
    if (rule.modules?.length && !rule.modules.every((m) => hasModule(session, m))) {
      const url = new URL('/unauthorized', pathname);
      url.searchParams.set('error', 'module_required');
      url.searchParams.set('module', rule.modules[0]);
      return NextResponse.redirect(url);
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const session = await getSessionFromRequest(request);
    if (session && AUTH_ONLY_PATHS.has(pathname)) {
      return NextResponse.redirect(new URL(getStaffHome(session), request.url));
    }
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    session.structureId &&
    session.licenseActive === false &&
    matchesPrefix(pathname, STAFF_PREFIXES)
  ) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'license_expired');
    return NextResponse.redirect(loginUrl);
  }

  const isClientArea = matchesPrefix(pathname, CLIENT_PREFIXES);
  const isStaffArea = matchesPrefix(pathname, STAFF_PREFIXES);

  if (isClientArea) {
    if (session.role !== 'CLIENT') {
      return NextResponse.redirect(new URL(getStaffHome(session), request.url));
    }
    return NextResponse.next();
  }

  if (isStaffArea) {
    if (session.role === 'CLIENT') {
      return NextResponse.redirect(new URL('/client', request.url));
    }
    if (!STAFF_ROLES.includes(session.role as (typeof STAFF_ROLES)[number])) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    const ruleRedirect = checkRouteRule(pathname, session);
    if (ruleRedirect) return ruleRedirect;

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf assets Next internes.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
