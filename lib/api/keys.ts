import { createHash, randomBytes } from 'crypto';

// Clés d'API des points : `shd_live_` + 40 caractères aléatoires (base64url).
// Seule l'empreinte SHA-256 est stockée (point_api_credentials.key_hash).

export const API_KEY_PREFIX = 'shd_live_';
export const API_MODULE = 'API';

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

/** Génère une clé ; renvoie la valeur en clair (à n'afficher qu'une fois), son préfixe visible et son empreinte. */
export function generateApiKey() {
  const key = API_KEY_PREFIX + randomBytes(30).toString('base64url');
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(key) };
}

export function looksLikeApiKey(value: string) {
  return value.startsWith(API_KEY_PREFIX) && value.length >= API_KEY_PREFIX.length + 32 && value.length <= 120;
}
