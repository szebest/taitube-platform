import { createReactI18n } from '@kit/intl-react';
import type { AppMessages } from '@vp/queries/intl';
import { WEB_SOURCE, type WebCatalogue, loadWebTranslation, webI18n } from './catalogue';

export * from './catalogue';

const { TranslatorProvider, useT } = createReactI18n(webI18n);

export { useT };

export const WEB_MESSAGES: AppMessages<WebCatalogue> = {
  source: WEB_SOURCE,
  load: loadWebTranslation,
  TranslatorProvider,
};
