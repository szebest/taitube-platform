import { createIntl, createIntlCache } from '@vp/intl';
import type { ActiveLocale } from '@vp/intl-react';
import { createTranslator, en, type SupportedLocale, type Translator } from '@vp/messages';

export type HeadWords = Readonly<{ locale: SupportedLocale; tOr: Translator['tOr'] }>;

/** A route's `head` runs outside React, so it cannot `useT`: its copy comes from the active locale here. */
export function headWords({ locale, catalogues }: ActiveLocale): HeadWords {
  const intl = createIntl({ locale, timeZone: 'UTC', cache: createIntlCache() });
  return { locale, tOr: createTranslator({ intl, catalogues: { ...catalogues, en } }).tOr };
}
