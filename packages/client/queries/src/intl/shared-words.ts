import { createReactI18n } from '@kit/intl-react';
import { sharedI18n } from '@vp/messages';

/** The shared catalogue's translator, for what this package renders itself in either app. */
export const sharedWords = createReactI18n(sharedI18n);

export const useT = sharedWords.useT;
