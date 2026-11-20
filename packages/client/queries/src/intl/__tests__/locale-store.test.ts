import { LOCALE_DETAILS } from '@vp/messages';
import { createLocaleStore, FALLBACK_ACTIVE_LOCALE } from '../locale-store';

describe('@vp/queries: createLocaleStore', () => {
  it('starts on en with no translation loaded, as the fallback does', () => {
    expect(createLocaleStore().snapshot()).toEqual(FALLBACK_ACTIVE_LOCALE);
    expect(FALLBACK_ACTIVE_LOCALE).toEqual({ locale: 'en', catalogues: {} });
  });

  it("loads the catalogue of the locale it activates through the locale's details", async () => {
    const store = createLocaleStore();

    await store.activate('pl');

    expect(store.snapshot()).toEqual({
      locale: 'pl',
      catalogues: { pl: await LOCALE_DETAILS.pl.load() },
    });
  });
});
