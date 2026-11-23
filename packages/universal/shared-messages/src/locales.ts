import { defineLocales, type LocaleDetails } from '@kit/intl';

export interface AppLocaleDetails extends LocaleDetails {
  /** How OpenGraph names it, `language_TERRITORY`. */
  readonly openGraph: string;
}

/** The locales both apps serve and the API negotiates, `en` the source every chain ends at. */
export const LOCALES = defineLocales<'en' | 'pl', AppLocaleDetails>({
  source: 'en',
  details: {
    en: { name: 'English', direction: 'ltr', openGraph: 'en_US' },
    pl: { name: 'Polski', direction: 'ltr', openGraph: 'pl_PL' },
  },
});

export type SupportedLocale = (typeof LOCALES.tags)[number];
