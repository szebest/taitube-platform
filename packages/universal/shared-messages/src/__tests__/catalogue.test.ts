import { describeI18nContract } from '@kit/i18n/contract';
import { sharedI18n } from '../catalogue';
import { en } from '../en';
import { pl } from '../pl';

describeI18nContract(() => ({
  i18n: sharedI18n,
  catalogues: { locale: 'en', source: en, translations: { pl } },
}));
