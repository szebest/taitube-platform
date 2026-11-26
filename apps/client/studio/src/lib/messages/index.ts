import { createReactI18n } from '@kit/intl-react';
import type { AppMessages } from '@vp/queries/intl';
import {
  STUDIO_SOURCE,
  type StudioCatalogue,
  loadStudioTranslation,
  studioI18n,
} from './catalogue';

export * from './catalogue';

const { TranslatorProvider, useT } = createReactI18n(studioI18n);

export { useT };

export const STUDIO_MESSAGES: AppMessages<StudioCatalogue> = {
  source: STUDIO_SOURCE,
  load: loadStudioTranslation,
  TranslatorProvider,
};
