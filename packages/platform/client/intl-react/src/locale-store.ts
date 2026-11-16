import { FALLBACK_LOCALE } from '@vp/intl';
import { type Catalogues, LOCALE_DETAILS, type SupportedLocale } from '@vp/messages';

export interface ActiveLocale {
  readonly locale: SupportedLocale;
  /** The active locale's catalogue, the only translation a visitor downloads. */
  readonly catalogues: Omit<Catalogues, 'en'>;
}

export interface LocaleStore {
  /** Loads the locale's catalogue, then renders in it; a later call that finishes first wins. */
  activate(locale: SupportedLocale): Promise<void>;
  snapshot(): ActiveLocale;
  subscribe(listener: () => void): () => void;
}

export const FALLBACK_ACTIVE_LOCALE: ActiveLocale = { locale: FALLBACK_LOCALE, catalogues: {} };

/** One per router: the server builds one per request, the browser one per page load. */
export function createLocaleStore(): LocaleStore {
  const listeners = new Set<() => void>();
  let active = FALLBACK_ACTIVE_LOCALE;
  let requested: SupportedLocale = FALLBACK_LOCALE;

  return {
    async activate(locale) {
      requested = locale;
      const catalogue = await LOCALE_DETAILS[locale].load();
      if (requested !== locale || active.locale === locale) return;

      active = { locale, catalogues: { [locale]: catalogue } };
      for (const listener of listeners) listener();
    },
    snapshot: () => active,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
