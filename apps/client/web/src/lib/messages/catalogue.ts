import type {
  ArgumentFreeKey as KitArgumentFreeKey,
  DisjointNamespaces,
  MessageKey as KitMessageKey,
  Translation,
  Translator as KitTranslator,
} from '@kit/i18n';
import { createI18n, en as sharedEn, type SupportedLocale } from '@vp/messages';
import { en } from '@vp/messages/web';

/** The web's catalogue: the shared words and its own, which never share a namespace. */
export type WebCatalogue = DisjointNamespaces<[typeof en, typeof sharedEn]>;

export type MessageKey = KitMessageKey<WebCatalogue>;

export type ArgumentFreeKey = KitArgumentFreeKey<WebCatalogue>;

export type Translator = KitTranslator<WebCatalogue>;

export const WEB_SOURCE: WebCatalogue = { ...sharedEn, ...en };

export const webI18n = createI18n<WebCatalogue>();

const TRANSLATIONS: Readonly<Record<SupportedLocale, () => Promise<Translation<WebCatalogue>>>> = {
  en: async () => ({}),
  pl: async () => (await import('./pl-translation')).pl,
};

/** A dynamic import for every locale but the source, so a visitor downloads one translation. */
export function loadWebTranslation(locale: SupportedLocale): Promise<Translation<WebCatalogue>> {
  return TRANSLATIONS[locale]();
}
