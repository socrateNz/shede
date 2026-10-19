/**
 * Thème du back-office. Par défaut, celui de l'appareil (« systeme ») ; le bouton de l'en-tête
 * permet de forcer le clair ou le sombre, choix gardé dans un cookie que le serveur applique
 * dès le premier affichage. Les couleurs sont décrites dans app/globals.css
 * (.dark, .theme-clair, et .theme-auto qui suit prefers-color-scheme sans attendre le JavaScript).
 */
export type Theme = 'systeme' | 'sombre' | 'clair';

/** Apparence réellement affichée. */
export type Appearance = 'sombre' | 'clair';

export const THEME_COOKIE = 'shede_theme';

export function parseTheme(value: string | null | undefined): Theme {
  return value === 'clair' || value === 'sombre' ? value : 'systeme';
}

/** Classe du conteneur : `dark` (sombre), `theme-clair` (clair) ou `theme-auto` (appareil). */
export function themeClass(theme: Theme) {
  if (theme === 'clair') return 'theme-clair';
  if (theme === 'sombre') return 'dark';
  return 'theme-auto';
}
