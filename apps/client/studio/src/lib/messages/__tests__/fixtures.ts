import type { Translation, Translator } from '@kit/i18n';
import { createIntl, createIntlCache, type IntlBinding } from '@kit/intl';
import { STUDIO_SOURCE, type StudioCatalogue, studioI18n } from '#app/lib/messages/catalogue';

const NOW = '2026-09-22T18:30:00.000Z';

function intlFor(locale: string): IntlBinding {
  return createIntl({ locale, timeZone: 'UTC', now: NOW, cache: createIntlCache() });
}

export function translatorFor(
  locale: string,
  translations: Readonly<Record<string, Translation<StudioCatalogue>>> = {}
): Translator<StudioCatalogue> {
  return studioI18n.createTranslator(intlFor(locale), {
    locale: 'en',
    source: STUDIO_SOURCE,
    translations,
  });
}
