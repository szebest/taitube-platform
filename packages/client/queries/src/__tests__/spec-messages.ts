import { createReactI18n } from '@kit/intl-react';
import { en, sharedI18n } from '@vp/messages';
import { pl } from '@vp/messages/pl';
import type { AppMessages } from '../intl';

const words = createReactI18n(sharedI18n);

/** An app whose catalogue is the shared one alone, as both apps' catalogues hold it. */
export const SPEC_MESSAGES: AppMessages<typeof en> = {
  source: en,
  load: async (locale) => (locale === 'pl' ? pl : {}),
  TranslatorProvider: words.TranslatorProvider,
};

export const useSpecT = words.useT;
