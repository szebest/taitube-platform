import type { Translation, Translator } from '@kit/i18n';
import { createIntl, createIntlCache, type IntlBinding } from '@kit/intl';
import { en } from '../en/studio-catalogue';
import { createI18n } from '../engine';

export const NOW = '2026-09-22T18:30:00.000Z';

const i18n = createI18n<typeof en>();

export function intlFor(locale: string): IntlBinding {
  return createIntl({ locale, timeZone: 'UTC', now: NOW, cache: createIntlCache() });
}

export function translatorFor(
  locale: string,
  translations: Readonly<Record<string, Translation<typeof en>>> = {}
): Translator<typeof en> {
  return i18n.createTranslator(intlFor(locale), { locale: 'en', source: en, translations });
}
