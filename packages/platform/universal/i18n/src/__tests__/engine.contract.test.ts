import { describeI18nContract } from '../contract';
import { catalogues, i18n } from './fixtures';

describeI18nContract(() => ({ i18n, catalogues }));
