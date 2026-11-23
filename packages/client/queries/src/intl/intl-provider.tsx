import type { Translation } from '@kit/i18n';
import {
  IntlProvider as KitIntlProvider,
  type IntlProviderProps as KitIntlProviderProps,
} from '@kit/intl-react';
import { en, type SharedCatalogue } from '@vp/shared-messages';
import type { AppMessages } from './app-messages';
import { SOURCE_LOCALE } from './locale-store';
import { sharedWords } from './shared-words';

const SYSTEM_CLOCK: KitIntlProviderProps['clock'] = { now: () => Date.now() };

export type IntlProviderProps<App extends SharedCatalogue> = Omit<KitIntlProviderProps, 'clock'> & {
  readonly messages: AppMessages<App>;
  /** The active locale's translation; keep the object stable, a new one rebuilds every binding. */
  readonly catalogues?: Readonly<Record<string, Translation<App>>>;
};

/**
 * `@kit/intl-react`'s provider with the app's translator and the shared one beside it, both over
 * the source catalogue and the active locale's translation.
 */
export function IntlProvider<App extends SharedCatalogue>({
  messages,
  catalogues = {},
  children,
  ...props
}: IntlProviderProps<App>) {
  const { TranslatorProvider } = messages;
  return (
    <KitIntlProvider {...props} clock={SYSTEM_CLOCK}>
      <sharedWords.TranslatorProvider
        catalogues={{ locale: SOURCE_LOCALE, source: en, translations: catalogues }}
      >
        <TranslatorProvider
          catalogues={{ locale: SOURCE_LOCALE, source: messages.source, translations: catalogues }}
        >
          {children}
        </TranslatorProvider>
      </sharedWords.TranslatorProvider>
    </KitIntlProvider>
  );
}
