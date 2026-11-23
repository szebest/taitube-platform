import { pl } from '@vp/shared-messages/pl';
import { SPEC_MESSAGES } from '../../__tests__/spec-messages';
import { createLocaleStore, FALLBACK_ACTIVE_LOCALE } from '../locale-store';

describe('@vp/queries: createLocaleStore', () => {
  it('starts on en with no translation loaded, as the fallback does', () => {
    expect(createLocaleStore(SPEC_MESSAGES).snapshot()).toEqual(FALLBACK_ACTIVE_LOCALE);
    expect(FALLBACK_ACTIVE_LOCALE).toEqual({ locale: 'en', catalogues: {} });
  });

  it("loads the translation of the locale it activates through the app's loader", async () => {
    const store = createLocaleStore(SPEC_MESSAGES);

    await store.activate('pl');

    expect(store.snapshot()).toEqual({ locale: 'pl', catalogues: { pl } });
  });
});
