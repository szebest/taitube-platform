import { type IntlBinding, createIntl, createIntlCache } from '@vp/intl';
import type { Catalogues } from '../catalogue';
import { type Translator, createTranslator } from '../create-translator';
import { en } from '../en';

export const NOW = '2026-09-22T18:30:00.000Z';

export function intlFor(locale: string): IntlBinding {
  return createIntl({ locale, timeZone: 'UTC', now: NOW, cache: createIntlCache() });
}

export function translatorFor(locale: string, extra: Omit<Catalogues, 'en'> = {}): Translator {
  return createTranslator({ intl: intlFor(locale), catalogues: { ...extra, en } });
}
