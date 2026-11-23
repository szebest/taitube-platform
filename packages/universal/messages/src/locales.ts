import { SUPPORTED_LOCALES } from '@kit/intl';

export interface LocaleDetails {
  /** The language's name in itself, which is how a chooser lists it. */
  readonly name: string;
  readonly direction: 'ltr' | 'rtl';
  /** How OpenGraph names it, `language_TERRITORY`. */
  readonly openGraph: string;
}

export { SUPPORTED_LOCALES };

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_DETAILS: Readonly<Record<SupportedLocale, LocaleDetails>> = {
  en: { name: 'English', direction: 'ltr', openGraph: 'en_US' },
  pl: { name: 'Polski', direction: 'ltr', openGraph: 'pl_PL' },
};

export function isSupportedLocale(tag: string): tag is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === tag);
}
