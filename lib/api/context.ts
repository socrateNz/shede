import { after, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { getTranslations } from '@/lib/i18n/server';
import { localeFromAcceptLanguage, type Locale } from '@/lib/i18n/config';
import { firstOf, isLicenseValid } from '@/lib/license';
import { API_MODULE, apiKeyMode, hashApiKey, type ApiKeyMode } from '@/lib/api/keys';

// Authentification et réponses de l'API publique (/api/v1).
// Une requête porte la clé d'un point : `Authorization: Bearer shd_live_…`
// (ou l'en-tête `X-Api-Key`). Le point, sa licence et son module API sont
// vérifiés à chaque appel.

/** Appels autorisés par point et par minute. */
export const RATE_LIMIT_PER_MINUTE = 60;

export type ApiErrorCode =
  | 'missing_key'
  | 'invalid_key'
  | 'module_disabled'
  | 'license_inactive'
  | 'point_inactive'
  | 'rate_limited'
  | 'not_found'
  | 'validation_error'
  | 'point_paused'
  | 'quota_exceeded'
  | 'invalid_state'
  | 'not_installed'
  | 'internal_error';

const STATUS: Record<ApiErrorCode, number> = {
  point_paused: 409,
  quota_exceeded: 403,
  invalid_state: 409,
  missing_key: 401,
  invalid_key: 401,
  module_disabled: 403,
  license_inactive: 403,
  point_inactive: 403,
  rate_limited: 429,
  not_found: 404,
  validation_error: 422,
  not_installed: 503,
  internal_error: 500,
};

export type ApiContext = {
  structureId: string;
  organizationId: string | null;
  structure: Record<string, any>;
  license: Record<string, any> | null;
  locale: Locale;
  t: ReturnType<typeof getTranslations>['t'];
  rate: { limit: number; remaining: number };
  /** 'test' : clé shd_test_ — rien n'est écrit en base, les commandes sont simulées. */
  mode: ApiKeyMode;
};

/**
 * Limitation de débit des clés de test, en mémoire (aucune écriture en base).
 * Approximative en hébergement multi-instances : suffisant pour un bac à sable.
 */
const testWindows = new Map<string, { minute: number; hits: number }>();
function testHit(structureId: string) {
  const minute = Math.floor(Date.now() / 60_000);
  const current = testWindows.get(structureId);
  const hits = current && current.minute === minute ? current.hits + 1 : 1;
  testWindows.set(structureId, { minute, hits });
  return hits;
}

function rateHeaders(rate?: ApiContext['rate']): Record<string, string> {
  if (!rate) return {};
  return {
    'X-RateLimit-Limit': String(rate.limit),
    'X-RateLimit-Remaining': String(Math.max(0, rate.remaining)),
  };
}

export function apiError(
  locale: Locale,
  code: ApiErrorCode,
  options: { details?: unknown; rate?: ApiContext['rate']; headers?: Record<string, string> } = {}
) {
  const { t } = getTranslations(locale);
  return NextResponse.json(
    { error: { code, message: t(`api.errors.${code}`), ...(options.details ? { details: options.details } : {}) } },
    {
      status: STATUS[code],
      headers: { 'Cache-Control': 'no-store', ...rateHeaders(options.rate), ...options.headers },
    }
  );
}

export function apiOk(ctx: ApiContext, data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: { 'Cache-Control': 'no-store', ...rateHeaders(ctx.rate) } });
}

function readKey(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return bearer || request.headers.get('x-api-key')?.trim() || '';
}

/** Vérifie la clé et renvoie le contexte du point, ou une réponse d'erreur prête à renvoyer. */
async function authenticate(request: Request): Promise<ApiContext | NextResponse> {
  const locale = localeFromAcceptLanguage(request.headers.get('accept-language'));
  const key = readKey(request);
  if (!key) return apiError(locale, 'missing_key');
  const mode = apiKeyMode(key);
  if (!mode) return apiError(locale, 'invalid_key');

  const admin = getAdminSupabase();
  const { data: credential, error } = await admin
    .from(mode === 'test' ? 'point_api_test_credentials' : 'point_api_credentials')
    .select('structure_id')
    .eq('key_hash', hashApiKey(key))
    .maybeSingle();
  if (error) {
    console.error('[api] lecture des clés :', error.message);
    // Table absente (migration phase 13 non exécutée) : 42P01 côté Postgres, PGRST205 côté PostgREST
    const missingTable = error.code === '42P01' || error.code === 'PGRST205';
    return apiError(locale, missingTable ? 'not_installed' : 'internal_error');
  }
  if (!credential) return apiError(locale, 'invalid_key');

  const { data: structure } = await admin
    .from('structures')
    .select('*, organizations!organization_id(id, licenses(*))')
    .eq('id', credential.structure_id)
    .maybeSingle();
  if (!structure) return apiError(locale, 'invalid_key');

  const organization = firstOf(structure.organizations as { id: string; licenses?: unknown } | null);
  const license = firstOf(organization?.licenses as Record<string, any> | Record<string, any>[] | null);
  if (!isLicenseValid(license)) return apiError(locale, 'license_inactive');
  if (!(structure.modules as string[] | null)?.includes(API_MODULE)) return apiError(locale, 'module_disabled');
  if (structure.is_active === false) return apiError(locale, 'point_inactive');

  let hits: number;
  if (mode === 'test') {
    hits = testHit(structure.id);
  } else {
    const { data, error: hitError } = await admin.rpc('api_hit', { p_structure_id: structure.id });
    if (hitError) {
      console.error('[api] limitation de débit :', hitError.message);
      return apiError(locale, 'internal_error');
    }
    hits = Number(data);
  }
  const rate = { limit: RATE_LIMIT_PER_MINUTE, remaining: RATE_LIMIT_PER_MINUTE - hits };
  if (rate.remaining < 0) {
    const retryAfter = 60 - new Date().getSeconds();
    return apiError(locale, 'rate_limited', { rate, headers: { 'Retry-After': String(retryAfter) } });
  }

  // Clé de production uniquement : date de dernière utilisation et relance des webhooks.
  if (mode === 'live') after(async () => {
    await admin
      .from('point_api_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('structure_id', structure.id);
    // Chaque appel de la marketplace relance aussi ses webhooks en échec.
    const { processDueWebhooks } = await import('@/lib/api/webhooks');
    await processDueWebhooks({ structureId: structure.id, limit: 5 });
  });

  const { organizations: _org, ...point } = structure;
  return {
    structureId: structure.id,
    organizationId: organization?.id ?? null,
    structure: point,
    license,
    locale,
    t: getTranslations(locale).t,
    rate,
    mode,
  };
}

/** Corps JSON de la requête, ou null s'il est absent / invalide. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Enveloppe d'une route de l'API : authentification, puis appel du
 * gestionnaire ; toute exception devient une erreur 500 propre.
 */
export function withApi<P = Record<string, string>>(
  handler: (ctx: ApiContext, request: Request, params: P) => Promise<Response>
) {
  return async (request: Request, segment: { params: Promise<P> }) => {
    const auth = await authenticate(request);
    if (auth instanceof NextResponse) return auth;
    try {
      return await handler(auth, request, await segment.params);
    } catch (error) {
      console.error('[api] erreur :', error);
      return apiError(auth.locale, 'internal_error', { rate: auth.rate });
    }
  };
}
