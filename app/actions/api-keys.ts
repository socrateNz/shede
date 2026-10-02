'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { te } from '@/lib/i18n/server';
import { firstOf } from '@/lib/license';
import { API_MODULE, generateApiKey, type ApiKeyMode } from '@/lib/api/keys';
import {
  generateWebhookSecret,
  isAllowedWebhookUrl,
  retryDelivery,
  sendTestWebhook,
} from '@/lib/api/webhooks';

// Clés d'API des points (docs/phase13-api.sql), gérées uniquement par
// l'administrateur de l'organisation propriétaire du point.

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

async function requireOwnedPoint(pointId: string) {
  const session = await getSession();
  if (!session || session.role !== 'ORG_ADMIN' || !session.organizationId) return null;
  const { data: point } = await getAdminSupabase()
    .from('structures')
    .select('id, organization_id, organizations!organization_id(modules, licenses(*))')
    .eq('id', pointId)
    .eq('organization_id', session.organizationId)
    .maybeSingle();
  if (!point) return null;
  const organization = firstOf(point.organizations as { modules?: string[]; licenses?: unknown } | null);
  const license = firstOf(organization?.licenses as Record<string, any> | Record<string, any>[] | null);
  return {
    session,
    point,
    moduleEnabled: Boolean(organization?.modules?.includes(API_MODULE)),
    quota: license && 'api_monthly_orders' in license ? (license.api_monthly_orders as number | null) : 500,
  };
}

export type PointApiStatus = {
  moduleEnabled: boolean;
  installed: boolean;
  credential: { prefix: string; createdAt: string; lastUsedAt: string | null } | null;
  /** Clé de test (shd_test_) : null si absente ; testInstalled = false avant l'étape 4 de phase13. */
  testCredential: { prefix: string; createdAt: string } | null;
  testInstalled: boolean;
  usage: { month: string; requests: number; orders: number; organizationOrders: number };
  quota: number | null;
  /** null tant que l'étape 3 de docs/phase13-api.sql n'est pas exécutée. */
  webhook: {
    url: string | null;
    secret: string | null;
    deliveries: {
      id: string;
      eventType: string;
      status: 'PENDING' | 'DELIVERED' | 'FAILED';
      attempts: number;
      lastStatusCode: number | null;
      lastError: string | null;
      createdAt: string;
    }[];
  } | null;
};

async function loadWebhook(pointId: string): Promise<PointApiStatus['webhook']> {
  const admin = getAdminSupabase();
  const { data: credential, error } = await admin
    .from('point_api_credentials')
    .select('webhook_url, webhook_secret')
    .eq('structure_id', pointId)
    .maybeSingle();
  if (error) return null;
  const { data: deliveries } = await admin
    .from('webhook_deliveries')
    .select('id, event_type, status, attempts, last_status_code, last_error, created_at')
    .eq('structure_id', pointId)
    .order('created_at', { ascending: false })
    .limit(10);
  return {
    url: credential?.webhook_url ?? null,
    secret: credential?.webhook_secret ?? null,
    deliveries: (deliveries || []).map((d) => ({
      id: d.id,
      eventType: d.event_type,
      status: d.status,
      attempts: d.attempts,
      lastStatusCode: d.last_status_code,
      lastError: d.last_error,
      createdAt: d.created_at,
    })),
  };
}

/** État de l'API pour un point : clé active, consommation du mois, quota de l'organisation. */
export async function getPointApiStatus(pointId: string): Promise<PointApiStatus | null> {
  const owned = await requireOwnedPoint(pointId);
  if (!owned) return null;
  const admin = getAdminSupabase();
  const month = new Date();
  const monthStart = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
  const empty = { month: monthStart, requests: 0, orders: 0, organizationOrders: 0 };

  const { data: credential, error } = await admin
    .from('point_api_credentials')
    .select('key_prefix, created_at, last_used_at')
    .eq('structure_id', pointId)
    .maybeSingle();
  if (error) {
    return {
      moduleEnabled: owned.moduleEnabled,
      installed: false,
      credential: null,
      testCredential: null,
      testInstalled: false,
      usage: empty,
      quota: owned.quota,
      webhook: null,
    };
  }
  const { data: testCredential, error: testError } = await admin
    .from('point_api_test_credentials')
    .select('key_prefix, created_at')
    .eq('structure_id', pointId)
    .maybeSingle();

  // Le quota porte sur toute l'organisation : on additionne les commandes de ses points.
  const { data: points } = await admin.from('structures').select('id').eq('organization_id', owned.point.organization_id);
  const { data: usage } = await admin
    .from('api_usage')
    .select('structure_id, requests, orders')
    .eq('month', monthStart)
    .in('structure_id', (points || []).map((p) => p.id));
  const own = (usage || []).find((u) => u.structure_id === pointId);

  return {
    moduleEnabled: owned.moduleEnabled,
    installed: true,
    credential: credential
      ? { prefix: credential.key_prefix, createdAt: credential.created_at, lastUsedAt: credential.last_used_at }
      : null,
    testCredential: testCredential ? { prefix: testCredential.key_prefix, createdAt: testCredential.created_at } : null,
    testInstalled: !testError,
    usage: {
      month: monthStart,
      requests: own?.requests ?? 0,
      orders: own?.orders ?? 0,
      organizationOrders: (usage || []).reduce((s, u) => s + (u.orders || 0), 0),
    },
    quota: owned.quota,
    webhook: credential ? await loadWebhook(pointId) : null,
  };
}

/** Enregistre l'adresse du webhook (vide = désactivé). Un secret est créé au premier enregistrement. */
export async function saveWebhookUrl(pointId: string, url: string): Promise<Result> {
  const owned = await requireOwnedPoint(pointId);
  if (!owned) return { success: false, error: await te('api.errorsAction.forbidden') };
  const clean = String(url || '').trim();
  if (clean && !isAllowedWebhookUrl(clean)) return { success: false, error: await te('api.webhooks.invalidUrl') };

  const admin = getAdminSupabase();
  const { data: credential } = await admin
    .from('point_api_credentials')
    .select('webhook_secret')
    .eq('structure_id', pointId)
    .maybeSingle();
  if (!credential) return { success: false, error: await te('api.webhooks.keyFirst') };

  const { error } = await admin
    .from('point_api_credentials')
    .update({ webhook_url: clean || null, webhook_secret: credential.webhook_secret ?? generateWebhookSecret() })
    .eq('structure_id', pointId);
  if (error) return { success: false, error: await te('api.errorsAction.failed') };
  revalidatePath(`/organization/points/${pointId}`);
  return { success: true };
}

export async function regenerateWebhookSecret(pointId: string): Promise<Result> {
  const owned = await requireOwnedPoint(pointId);
  if (!owned) return { success: false, error: await te('api.errorsAction.forbidden') };
  const { error } = await getAdminSupabase()
    .from('point_api_credentials')
    .update({ webhook_secret: generateWebhookSecret() })
    .eq('structure_id', pointId);
  if (error) return { success: false, error: await te('api.errorsAction.failed') };
  revalidatePath(`/organization/points/${pointId}`);
  return { success: true };
}

/** Envoie un événement « ping » et renvoie le code HTTP obtenu. */
export async function testWebhook(pointId: string): Promise<Result<{ delivered: boolean; detail: string }>> {
  const owned = await requireOwnedPoint(pointId);
  if (!owned) return { success: false, error: await te('api.errorsAction.forbidden') };
  const result = await sendTestWebhook(pointId);
  if (!result) return { success: false, error: await te('api.errorsAction.failed') };
  revalidatePath(`/organization/points/${pointId}`);
  return {
    success: true,
    data: {
      delivered: result.status === 'DELIVERED',
      detail: result.last_status_code ? `HTTP ${result.last_status_code}` : result.last_error ?? '',
    },
  };
}

export async function retryWebhookDelivery(pointId: string, deliveryId: string): Promise<Result> {
  const owned = await requireOwnedPoint(pointId);
  if (!owned) return { success: false, error: await te('api.errorsAction.forbidden') };
  await retryDelivery(pointId, deliveryId);
  revalidatePath(`/organization/points/${pointId}`);
  return { success: true };
}

const KEY_TABLES: Record<ApiKeyMode, string> = {
  live: 'point_api_credentials',
  test: 'point_api_test_credentials',
};

/**
 * Génère (ou régénère) la clé du point — de production, ou de test (shd_test_ :
 * accès au menu réel, commandes simulées sans aucune écriture en base).
 * L'ancienne clé du même mode cesse immédiatement de fonctionner.
 */
export async function generatePointApiKey(pointId: string, mode: ApiKeyMode = 'live'): Promise<Result<{ key: string }>> {
  const owned = await requireOwnedPoint(pointId);
  if (!owned) return { success: false, error: await te('api.errorsAction.forbidden') };
  if (!owned.moduleEnabled) return { success: false, error: await te('api.errorsAction.moduleRequired') };

  const keyMode: ApiKeyMode = mode === 'test' ? 'test' : 'live';
  const { key, prefix, hash } = generateApiKey(keyMode);
  const row = {
    structure_id: pointId,
    key_prefix: prefix,
    key_hash: hash,
    created_by: owned.session.userId,
    created_at: new Date().toISOString(),
    ...(keyMode === 'live' ? { last_used_at: null } : {}),
  };
  const { error } = await getAdminSupabase().from(KEY_TABLES[keyMode]).upsert(row, { onConflict: 'structure_id' });
  if (error) {
    console.error('[api-keys] génération :', error.message);
    return { success: false, error: await te('api.errorsAction.failed') };
  }
  revalidatePath(`/organization/points/${pointId}`);
  return { success: true, data: { key } };
}

export async function revokePointApiKey(pointId: string, mode: ApiKeyMode = 'live'): Promise<Result> {
  const owned = await requireOwnedPoint(pointId);
  if (!owned) return { success: false, error: await te('api.errorsAction.forbidden') };
  const table = KEY_TABLES[mode === 'test' ? 'test' : 'live'];
  const { error } = await getAdminSupabase().from(table).delete().eq('structure_id', pointId);
  if (error) return { success: false, error: await te('api.errorsAction.failed') };
  revalidatePath(`/organization/points/${pointId}`);
  return { success: true };
}
