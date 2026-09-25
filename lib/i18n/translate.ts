import type { Dictionary } from '@/dictionaries';

/** Toutes les clés « namespace.cle » du dictionnaire (vérifiées à la compilation). */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;
export type TranslationParams = Record<string, string | number>;
export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

/**
 * Crée la fonction `t`. Les paramètres s'écrivent `{nom}` dans les textes :
 * t('orders.count', { count: 3 }) → « 3 commandes ».
 */
export function createTranslator(dictionary: Dictionary): Translator {
  return (key, params) => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dictionary);

    if (typeof value !== 'string') {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] clé manquante : ${key}`);
      return key;
    }
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match
    );
  };
}
