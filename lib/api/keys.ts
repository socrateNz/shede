import { createHash, randomBytes } from 'crypto';

// Clés d'API des points : `shd_live_` (production) ou `shd_test_` (bac à sable)
// + 40 caractères aléatoires (base64url). Seule l'empreinte SHA-256 est stockée
// (point_api_credentials / point_api_test_credentials).

export const API_KEY_PREFIX = 'shd_live_';
export const API_TEST_KEY_PREFIX = 'shd_test_';
export const API_MODULE = 'API';

export type ApiKeyMode = 'live' | 'test';

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

/** Génère une clé ; renvoie la valeur en clair (à n'afficher qu'une fois), son préfixe visible et son empreinte. */
export function generateApiKey(mode: ApiKeyMode = 'live') {
  const key = (mode === 'test' ? API_TEST_KEY_PREFIX : API_KEY_PREFIX) + randomBytes(30).toString('base64url');
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(key) };
}

/** Mode d'une clé d'après son préfixe, ou null si elle n'a pas le bon format. */
export function apiKeyMode(value: string): ApiKeyMode | null {
  const prefix = value.startsWith(API_KEY_PREFIX) ? 'live' : value.startsWith(API_TEST_KEY_PREFIX) ? 'test' : null;
  if (!prefix || value.length < API_KEY_PREFIX.length + 32 || value.length > 120) return null;
  return prefix;
}

export function looksLikeApiKey(value: string) {
  return apiKeyMode(value) !== null;
}
