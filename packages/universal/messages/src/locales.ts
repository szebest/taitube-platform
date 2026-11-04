import { FALLBACK_LOCALE } from '@vp/intl';
import type { Catalogues } from './catalogue';
import { en } from './en';

type Translation = Catalogues[string];

export interface LocaleDetails {
  /** The language's name in itself, which is how a chooser lists it. */
  readonly name: string;
  readonly direction: 'ltr' | 'rtl';
  /** A dynamic import for every language but the fallback, so a visitor downloads one catalogue. */
  readonly load: () => Promise<Translation>;
}

export const SUPPORTED_LOCALES = [FALLBACK_LOCALE, 'pl'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_DETAILS: Readonly<Record<SupportedLocale, LocaleDetails>> = {
  en: { name: 'English', direction: 'ltr', load: async () => en },
  pl: { name: 'Polski', direction: 'ltr', load: async () => (await import('./pl')).pl },
};

export function isSupportedLocale(tag: string): tag is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === tag);
}
