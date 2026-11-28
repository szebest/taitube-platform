import type { Container } from '@kit/composition';
import { createIntl, createIntlCache } from '@kit/intl';
import { en, LOCALES, sharedI18n } from '@vp/shared-messages';
import { pl } from '@vp/shared-messages/pl';
import { FailureWords } from '../services/failure-words';
import { Services } from './service-tokens';

export function registerFailureWords(c: Container): Container {
  return c.provide(Services.FailureWords, () => {
    const cache = createIntlCache();
    const catalogues = { locale: LOCALES.source, source: en, translations: { pl } };
    return new FailureWords(
      new Map(
        LOCALES.tags.map((locale) => [
          locale,
          sharedI18n.createTranslator(createIntl({ locale, timeZone: 'UTC', cache }), catalogues),
        ])
      )
    );
  });
}
