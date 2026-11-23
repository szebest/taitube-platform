import type {
  ArgumentFreeKey as KitArgumentFreeKey,
  MessageKey as KitMessageKey,
  Translation,
  Translator,
} from '@kit/i18n';
import type { en } from './en';
import { createI18n } from './engine';

/** The shared catalogue's type: every app's catalogue holds it, merged with the app's own. */
export type SharedCatalogue = typeof en;

export type SharedMessageKey = KitMessageKey<SharedCatalogue>;

/** A shared key whose message takes no arguments, and so can render with nothing but its name. */
export type SharedArgumentFreeKey = KitArgumentFreeKey<SharedCatalogue>;

export type SharedTranslation = Translation<SharedCatalogue>;

export type SharedTranslator = Translator<SharedCatalogue>;

export const sharedI18n = createI18n<SharedCatalogue>();
