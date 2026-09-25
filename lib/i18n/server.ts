import { cookies, headers } from 'next/headers';
import { dictionaries } from '@/dictionaries';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from '@/lib/i18n/config';
import { createTranslator, type TranslationKey, type TranslationParams } from '@/lib/i18n/translate';
import { createFormatters } from '@/lib/i18n/format';

/**
 * Langue de la requête : cookie choisi par l'utilisateur, sinon langue du
 * navigateur, sinon français.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
    if (isLocale(fromCookie)) return fromCookie;
    const headerStore = await headers();
    return localeFromAcceptLanguage(headerStore.get('accept-language'));
  } catch {
    // Hors contexte de requête (tâche planifiée, script…)
    return DEFAULT_LOCALE;
  }
}

/** Traducteur et formats pour une langue donnée (emails, tâches planifiées…). */
export function getTranslations(locale: Locale) {
  return {
    locale,
    t: createTranslator(dictionaries[locale]),
    format: createFormatters(locale),
  };
}

/** Traducteur de la requête courante (Server Components, Server Actions). */
export async function getT() {
  return getTranslations(await getLocale());
}

/** Un seul texte traduit, dans la langue de la requête (messages d'erreur des Server Actions). */
export async function te(key: TranslationKey, params?: TranslationParams) {
  const { t } = await getT();
  return t(key, params);
}
