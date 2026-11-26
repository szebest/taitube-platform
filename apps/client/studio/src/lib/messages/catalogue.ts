import type {
  ArgumentFreeKey as KitArgumentFreeKey,
  DisjointNamespaces,
  MessageKey as KitMessageKey,
  Translation,
} from '@kit/i18n';
import { createI18n, en as sharedEn, type SupportedLocale } from '@vp/shared-messages';
import { en } from './en';

/** The studio's catalogue: the shared words and its own, which never share a namespace. */
export type StudioCatalogue = DisjointNamespaces<[typeof en, typeof sharedEn]>;

/** @public */
export type MessageKey = KitMessageKey<StudioCatalogue>;

export type ArgumentFreeKey = KitArgumentFreeKey<StudioCatalogue>;

export const STUDIO_SOURCE: StudioCatalogue = { ...sharedEn, ...en };

export const studioI18n = createI18n<StudioCatalogue>();

const TRANSLATIONS: Readonly<Record<SupportedLocale, () => Promise<Translation<StudioCatalogue>>>> =
  {
    en: async () => ({}),
    pl: async () => (await import('./pl-translation')).pl,
  };

/** A dynamic import for every locale but the source, so a visitor downloads one translation. */
export function loadStudioTranslation(
  locale: SupportedLocale
): Promise<Translation<StudioCatalogue>> {
  return TRANSLATIONS[locale]();
}
