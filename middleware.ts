import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SessionPayload } from '@/lib/auth';
import { getSessionFromRequest, hasModule } from '@/lib/auth-session';

/** Tous les rôles staff (hors CLIENT) */
const STAFF_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'ADMIN',
  'MANAGER',
  'CAISSE',
  'SERVEUR',
  'RECEPTION',
  'CUISINIER',
  'BAR',
  'LIVREUR',
  'COMPTABLE',
  'MAGASINIER',
  'RH',
] as const;

/** Chemins accessibles sans connexion */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/register-client',
  '/register-business',
  '/docs',
  '/docs/api',
  '/unauthorized',
  '/cart',
  '/forgot-password',
  '/reset-password',
]);

/** Préfixes publics (catalogue B2C, assets) */
const PUBLIC_PREFIXES = [
  '/client/structure',
  '/_next',
  '/api/setup',
  '/api/cron', // protégé par CRON_SECRET dans la route
  '/api/v1', // API publique : authentifiée par la clé du point dans chaque route
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
  '/categories',
  '/notifications',
  '/settings',
  '/statistics',
  '/shifts',
  '/kitchen',
  '/bar',
  '/delivery',
  '/hr',
  '/clients',
  '/floor-manager',
  '/organization',
  '/accounting',
];

/** Espace de l'administrateur d'organisation (il n'opère pas dans les points). */
const ORG_ADMIN_PREFIXES = ['/organization', '/accounting'];

type RouteRule = {
  prefix: string;
  roles: readonly string[];
  modules?: string[];
};

/**
 * Règles d'accès par préfixe.
 * SUPER_ADMIN bypasse toutes les règles (voir checkRouteRule).
 */
const ROUTE_RULES: RouteRule[] = [
  // Administration globale
  { prefix: '/structures', roles: ['SUPER_ADMIN'] },

  // Administration d'organisation (points + admins de point)
  { prefix: '/organization', roles: ['ORG_ADMIN'] },

  // Gestion équipe & RH
  { prefix: '/users',    roles: ['ADMIN', 'SUPER_ADMIN', 'RH'] },

  // Produits & menu
  { prefix: '/products',       roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
  { prefix: '/accompaniments', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
  { prefix: '/categories',     roles: ['ADMIN', 'SUPER_ADMIN'] },

  // Commandes
  { prefix: '/orders', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CAISSE', 'SERVEUR'] },

  // Cuisine & Bar
  { prefix: '/kitchen',  roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CUISINIER'], modules: ['CUISINE'] },
  { prefix: '/bar',      roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BAR'],       modules: ['BAR'] },

  // Livraison
  { prefix: '/delivery', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'LIVREUR'],   modules: ['LIVRAISON'] },

  // Hôtel (module requis)
  { prefix: '/bookings', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'RECEPTION'], modules: ['HOTEL'] },
  { prefix: '/rooms',    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'RECEPTION'], modules: ['HOTEL'] },

  // Stock
  { prefix: '/stock', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'MAGASINIER'], modules: ['STOCK'] },
  // Coût matière (prix de revient, marges) : pas pour le magasinier
  { prefix: '/stock/food-cost', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'], modules: ['STOCK'] },

  // Promotions
  { prefix: '/promotions', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'], modules: ['PROMOTION'] },

  // Statistiques & Finances
  { prefix: '/statistics', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'COMPTABLE'] },
  { prefix: '/shifts',     roles: ['ADMIN', 'SUPER_ADMIN', 'CAISSE', 'COMPTABLE'] },

  // Comptabilité (les pages restreignent ensuite par rôle : le manager ne voit que les dépenses)
  { prefix: '/accounting', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'COMPTABLE', 'ORG_ADMIN'], modules: ['COMPTABILITE'] },

  // RH
  { prefix: '/hr', roles: ['ADMIN', 'SUPER_ADMIN', 'RH'], modules: ['RH'] },

  // CRM Clients
  { prefix: '/clients', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CAISSE'], modules: ['CRM'] },

  // Floor Manager
  { prefix: '/floor-manager', roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SERVEUR', 'CAISSE'], modules: ['TABLES'] },
];

const AUTH_ONLY_PATHS = new Set(['/login', '/register-client', '/register-business', '/forgot-password']);

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

/** Redirige le staff vers sa page d'accueil selon son rôle */
function getStaffHome(session: SessionPayload): string {
  switch (session.role) {
    case 'SUPER_ADMIN':  return '/structures';
    case 'ORG_ADMIN':    return '/organization';
    case 'CLIENT':       return '/client';
    case 'CUISINIER':    return '/kitchen';
    case 'BAR':          return '/bar';
    case 'LIVREUR':      return '/delivery';
    case 'MAGASINIER':   return '/stock';
    // La page Statistiques est réservée à l'administrateur : le comptable va à sa comptabilité.
    case 'COMPTABLE':    return hasModule(session, 'COMPTABILITE') ? '/accounting' : '/dashboard';
    case 'RH':           return '/users';
    default:             return '/dashboard';
  }
}

function checkRouteRule(
  pathname: string,
  session: SessionPayload,
  requestUrl: string
): NextResponse | null {
  if (session.role === 'SUPER_ADMIN') return null;

  for (const rule of ROUTE_RULES) {
    if (pathname !== rule.prefix && !pathname.startsWith(`${rule.prefix}/`)) {
      continue;
    }
    if (!rule.roles.includes(session.role)) {
      return NextResponse.redirect(new URL('/unauthorized', requestUrl));
    }
    if (rule.modules?.length && !rule.modules.every((m) => hasModule(session, m))) {
      const url = new URL('/unauthorized', requestUrl);
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
    (session.structureId || session.organizationId) &&
    session.licenseActive === false &&
    matchesPrefix(pathname, STAFF_PREFIXES)
  ) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'license_expired');
    return NextResponse.redirect(loginUrl);
  }

  const isClientArea = matchesPrefix(pathname, CLIENT_PREFIXES);
  const isStaffArea  = matchesPrefix(pathname, STAFF_PREFIXES);

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
    if (session.role === 'ORG_ADMIN' && !matchesPrefix(pathname, ORG_ADMIN_PREFIXES)) {
      return NextResponse.redirect(new URL('/organization', request.url));
    }

    const ruleRedirect = checkRouteRule(pathname, session, request.url);
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
