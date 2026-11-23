import type { Translation } from '@kit/i18n';
import type { ReactI18n } from '@kit/intl-react';
import type { SharedCatalogue, SupportedLocale } from '@vp/shared-messages';

/**
 * What a client app hands the shared providers about its words: its source catalogue (the shared
 * one merged with its own), the loader of each locale's translation, and its translator provider.
 */
export interface AppMessages<App extends SharedCatalogue> {
  readonly source: App;
  /** A dynamic import for every locale but the source, so a visitor downloads one translation. */
  readonly load: (locale: SupportedLocale) => Promise<Translation<App>>;
  readonly TranslatorProvider: ReactI18n<App>['TranslatorProvider'];
}
