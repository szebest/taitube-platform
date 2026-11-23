export interface ActiveLocale<Locale extends string, Catalogue> {
  readonly locale: Locale;
  /** The active locale's catalogue, the only translation a visitor downloads. */
  readonly catalogues: Readonly<Record<string, Catalogue>>;
}

export interface LocaleStore<Locale extends string, Catalogue> {
  /** Loads the locale's catalogue, then renders in it; a later call that finishes first wins. */
  activate(locale: Locale): Promise<void>;
  snapshot(): ActiveLocale<Locale, Catalogue>;
  subscribe(listener: () => void): () => void;
}

export interface LocaleStoreOptions<Locale extends string, Catalogue> {
  /** The locale the store starts on, whose catalogue the app holds already. */
  readonly fallbackLocale: Locale;
  /** One dynamic import per language but the fallback, so a visitor downloads one catalogue. */
  readonly load: (locale: Locale) => Promise<Catalogue>;
}

/** @public */
export function fallbackActiveLocale<Locale extends string, Catalogue>(
  fallbackLocale: Locale
): ActiveLocale<Locale, Catalogue> {
  return { locale: fallbackLocale, catalogues: {} };
}

/** One per router: the server builds one per request, the browser one per page load. */
export function createLocaleStore<Locale extends string, Catalogue>({
  fallbackLocale,
  load,
}: LocaleStoreOptions<Locale, Catalogue>): LocaleStore<Locale, Catalogue> {
  const listeners = new Set<() => void>();
  let active = fallbackActiveLocale<Locale, Catalogue>(fallbackLocale);
  let requested = fallbackLocale;

  return {
    async activate(locale) {
      requested = locale;
      const catalogue = await load(locale);
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
