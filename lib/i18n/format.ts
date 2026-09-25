import { INTL_LOCALES, type Locale } from '@/lib/i18n/config';

/** Formats de dates, nombres et montants selon la langue (conventions du Cameroun). */
export function createFormatters(locale: Locale) {
  const intl = INTL_LOCALES[locale];

  const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

  return {
    intl,
    /** 25/09/2026 */
    date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      toDate(value).toLocaleDateString(intl, options),
    /** 25/09/2026 14:30 */
    dateTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      toDate(value).toLocaleString(intl, options ?? { dateStyle: 'short', timeStyle: 'short' }),
    /** 14:30 */
    time: (value: Date | string | number) =>
      toDate(value).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' }),
    /** 12 500 */
    number: (value: number | string | null | undefined, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(intl, options).format(Number(value) || 0),
    /** 12 500 FCFA (XAF et XOF s'affichent « FCFA ») */
    money: (value: number | string | null | undefined, currency = 'XAF') => {
      const label = currency === 'XAF' || currency === 'XOF' ? 'FCFA' : currency;
      return `${new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }).format(Number(value) || 0)} ${label}`;
    },
  };
}

export type Formatters = ReturnType<typeof createFormatters>;
