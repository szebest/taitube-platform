import { createIntl, createIntlCache } from '@kit/intl';
import type { SupportedLocale } from '@vp/messages';
import type { ActiveLocale } from '@vp/queries/intl';
import {
  type Translator,
  WEB_SOURCE,
  type WebCatalogue,
  webI18n,
} from '#app/lib/messages/catalogue';

export type HeadWords = Readonly<{ locale: SupportedLocale; tOr: Translator['tOr'] }>;

/** A route's `head` runs outside React, so it cannot `useT`: its copy comes from the active locale here. */
export function headWords({ locale, catalogues }: ActiveLocale<WebCatalogue>): HeadWords {
  const intl = createIntl({ locale, timeZone: 'UTC', cache: createIntlCache() });
  const translations = { locale: 'en', source: WEB_SOURCE, translations: catalogues };
  return { locale, tOr: webI18n.createTranslator(intl, translations).tOr };
}
