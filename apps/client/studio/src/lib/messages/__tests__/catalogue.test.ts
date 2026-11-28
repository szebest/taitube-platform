import { describeI18nContract } from '@kit/i18n/contract';
import { loadStudioTranslation, STUDIO_SOURCE, studioI18n } from '../catalogue';

const pl = await loadStudioTranslation('pl');

describeI18nContract(() => ({
  i18n: studioI18n,
  catalogues: { locale: 'en', source: STUDIO_SOURCE, translations: { pl } },
}));
