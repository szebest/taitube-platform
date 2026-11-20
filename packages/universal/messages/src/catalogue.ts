import type {
  ArgumentFreeKey as KitArgumentFreeKey,
  MessageKey as KitMessageKey,
  Translation as KitTranslation,
  Translator as KitTranslator,
} from '@kit/i18n';
import type { en } from './en';
import { createI18n } from './engine';

export type Catalogue = typeof en;

export type MessageKey = KitMessageKey<Catalogue>;

/** A key whose message takes no arguments, and so can render with nothing but its name. */
export type ArgumentFreeKey = KitArgumentFreeKey<Catalogue>;

/** Another locale's catalogue: any namespace or message may be missing, the chain fills the gap. */
export type Translation = KitTranslation<Catalogue>;

export type Translator = KitTranslator<Catalogue>;

export const i18n = createI18n<Catalogue>();
