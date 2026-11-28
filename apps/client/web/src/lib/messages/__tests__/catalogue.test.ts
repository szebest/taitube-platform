import { describeI18nContract } from '@kit/i18n/contract';
import { loadWebTranslation, WEB_SOURCE, webI18n } from '../catalogue';

const pl = await loadWebTranslation('pl');

describeI18nContract(() => ({
  i18n: webI18n,
  catalogues: { locale: 'en', source: WEB_SOURCE, translations: { pl } },
}));
