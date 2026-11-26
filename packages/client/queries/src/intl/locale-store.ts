import type { Translation } from '@kit/i18n';
import {
  type ActiveLocale as KitActiveLocale,
  createLocaleStore as createKitLocaleStore,
  type LocaleStore as KitLocaleStore,
} from '@kit/intl-react';
import type { SharedCatalogue } from '@vp/shared-messages';
import { LOCALES, type SupportedLocale } from '@vp/shared-messages/locales';
import type { AppMessages } from './app-messages';

export type ActiveLocale<App extends SharedCatalogue = SharedCatalogue> = KitActiveLocale<
  SupportedLocale,
  Translation<App>
>;

export type LocaleStore<App extends SharedCatalogue = SharedCatalogue> = KitLocaleStore<
  SupportedLocale,
  Translation<App>
>;

/** The source locale with nothing loaded, which any app's store starts on. */
export const FALLBACK_ACTIVE_LOCALE: {
  readonly locale: SupportedLocale;
  readonly catalogues: Readonly<Record<string, never>>;
} = { locale: LOCALES.source, catalogues: {} };

export function createLocaleStore<App extends SharedCatalogue>(
  messages: AppMessages<App>
): LocaleStore<App> {
  return createKitLocaleStore<SupportedLocale, Translation<App>>({
    fallbackLocale: LOCALES.source,
    load: messages.load,
  });
}
