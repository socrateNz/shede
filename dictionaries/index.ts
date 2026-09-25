import type { Locale } from '@/lib/i18n/config';
import { fr } from './fr';
import { en } from './en';

/** Structure du dictionnaire : celle du français, que l'anglais doit respecter. */
export type Dictionary = typeof fr;

export const dictionaries: Record<Locale, Dictionary> = { fr, en };
