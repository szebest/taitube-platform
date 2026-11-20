import { createIntl, createIntlCache, type IntlBinding } from '@kit/intl';
import { i18n, type Translation, type Translator } from '../catalogue';
import { en } from '../en';

export const NOW = '2026-09-22T18:30:00.000Z';

export function intlFor(locale: string): IntlBinding {
  return createIntl({ locale, timeZone: 'UTC', now: NOW, cache: createIntlCache() });
}

export function translatorFor(
  locale: string,
  translations: Readonly<Record<string, Translation>> = {}
): Translator {
  return i18n.createTranslator(intlFor(locale), { locale: 'en', source: en, translations });
}
