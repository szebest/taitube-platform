import {
  IntlProvider as AppIntlProvider,
  type IntlProviderProps as AppIntlProviderProps,
} from '@kit/intl-react';
import { en, i18n, type Translator } from '@vp/messages';
import type { ActiveLocale } from './locale-store';

declare module '@kit/intl-react' {
  interface IntlRegister {
    translator: Translator;
  }
}

const SYSTEM_CLOCK: AppIntlProviderProps['clock'] = { now: () => Date.now() };

export type IntlProviderProps = Omit<AppIntlProviderProps, 'clock' | 'createTranslator'> & {
  /** Translations beside `en`; keep the object stable, a new one rebuilds every binding. */
  readonly catalogues?: ActiveLocale['catalogues'];
};

/** `@kit/intl-react`'s provider over this app's messages, with `en` as the source catalogue. */
export function IntlProvider({ catalogues, ...props }: IntlProviderProps) {
  return (
    <AppIntlProvider
      {...props}
      clock={SYSTEM_CLOCK}
      createTranslator={(intl) =>
        i18n.createTranslator(intl, { locale: 'en', source: en, translations: catalogues ?? {} })
      }
    />
  );
}
