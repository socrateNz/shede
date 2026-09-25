/** Langues de l'application (le Cameroun est officiellement bilingue). */
export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/** Cookie qui mémorise la langue choisie (1 an). */
export const LOCALE_COOKIE = 'locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Locales Intl utilisées pour les dates et les nombres (formats du Cameroun). */
export const INTL_LOCALES: Record<Locale, string> = {
  fr: 'fr-CM',
  en: 'en-CM',
};

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Langue préférée d'après l'en-tête Accept-Language du navigateur. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const preferred = String(header ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase());
  return preferred.find(isLocale) ?? DEFAULT_LOCALE;
}
