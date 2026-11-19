import { FALLBACK_LOCALE } from '@kit/intl';
import {
  type ActiveLocale as AppActiveLocale,
  createLocaleStore as createAppLocaleStore,
  fallbackActiveLocale,
  type LocaleStore as AppLocaleStore,
} from '@kit/intl-react';
import { type Catalogues, LOCALE_DETAILS, type SupportedLocale } from '@vp/messages';

type Translation = Catalogues[string];

export type ActiveLocale = AppActiveLocale<SupportedLocale, Translation>;

export type LocaleStore = AppLocaleStore<SupportedLocale, Translation>;

export const FALLBACK_ACTIVE_LOCALE: ActiveLocale = fallbackActiveLocale(FALLBACK_LOCALE);

export function createLocaleStore(): LocaleStore {
  return createAppLocaleStore<SupportedLocale, Translation>({
    fallbackLocale: FALLBACK_LOCALE,
    load: (locale) => LOCALE_DETAILS[locale].load(),
  });
}
