import {
  type ActiveLocale,
  type LocaleStore,
  createLocaleStore,
  fallbackActiveLocale,
} from '../../index';

interface Catalogue {
  readonly hello: string;
}

const store = createLocaleStore<'en' | 'sv', Catalogue>({
  fallbackLocale: 'en',
  load: async () => ({ hello: 'hi' }),
});

expectTypeOf(store).toEqualTypeOf<LocaleStore<'en' | 'sv', Catalogue>>();
expectTypeOf(store.snapshot()).toEqualTypeOf<ActiveLocale<'en' | 'sv', Catalogue>>();
expectTypeOf(fallbackActiveLocale<'en', Catalogue>('en').locale).toEqualTypeOf<'en'>();

// @ts-expect-error a locale outside the set
store.activate('de');

createLocaleStore<'en' | 'sv', Catalogue>({
  // @ts-expect-error the fallback is one of the locales
  fallbackLocale: 'de',
  load: async () => ({ hello: 'hi' }),
});

createLocaleStore<'en' | 'sv', Catalogue>({
  fallbackLocale: 'en',
  // @ts-expect-error the loader returns the catalogue type
  load: async () => ({ bye: 'x' }),
});
