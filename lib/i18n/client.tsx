'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { dictionaries } from '@/dictionaries';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/translate';
import { createFormatters } from '@/lib/i18n/format';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Fournit la langue de la requête aux composants client (défini dans le layout racine). */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Traducteur et formats dans un composant client. */
export function useT() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      t: createTranslator(dictionaries[locale]),
      format: createFormatters(locale),
    }),
    [locale]
  );
}
