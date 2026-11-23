import type { Translation } from '@kit/i18n';
import { createIntl, createIntlCache, type IntlBinding } from '@kit/intl';
import {
  WEB_SOURCE,
  type WebCatalogue,
  type Translator,
  webI18n,
} from '#app/lib/messages/catalogue';

export const NOW = '2026-09-22T18:30:00.000Z';

export function intlFor(locale: string): IntlBinding {
  return createIntl({ locale, timeZone: 'UTC', now: NOW, cache: createIntlCache() });
}

export function translatorFor(
  locale: string,
  translations: Readonly<Record<string, Translation<WebCatalogue>>> = {}
): Translator {
  return webI18n.createTranslator(intlFor(locale), {
    locale: 'en',
    source: WEB_SOURCE,
    translations,
  });
}
