import { createIntl, createIntlCache } from '@kit/intl';
import { en, i18n, type SupportedLocale, type Translator } from '@vp/messages';
import type { ActiveLocale } from '@vp/queries/intl';

export type HeadWords = Readonly<{ locale: SupportedLocale; tOr: Translator['tOr'] }>;

/** A route's `head` runs outside React, so it cannot `useT`: its copy comes from the active locale here. */
export function headWords({ locale, catalogues }: ActiveLocale): HeadWords {
  const intl = createIntl({ locale, timeZone: 'UTC', cache: createIntlCache() });
  return {
    locale,
    tOr: i18n.createTranslator(intl, { locale: 'en', source: en, translations: catalogues }).tOr,
  };
}
