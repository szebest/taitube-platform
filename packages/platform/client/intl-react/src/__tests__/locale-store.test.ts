import { createLocaleStore } from '../locale-store';

type Locale = 'en' | 'pl';
type Catalogue = { readonly name: string };

const CATALOGUES: Record<Locale, Catalogue> = { en: { name: 'English' }, pl: { name: 'Polski' } };

function createWatchedStore() {
  const load = vi.fn(async (locale: Locale) => CATALOGUES[locale]);
  const store = createLocaleStore<Locale, Catalogue>({ fallbackLocale: 'en', load });
  const notified = vi.fn();
  store.subscribe(notified);
  return { store, notified, load };
}

describe('@kit/intl-react: createLocaleStore', () => {
  it('starts on the fallback locale with no translation loaded', () => {
    const { store, load } = createWatchedStore();

    expect(store.snapshot()).toEqual({ locale: 'en', catalogues: {} });
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the catalogue of the locale it activates, and tells its subscribers', async () => {
    const { store, notified, load } = createWatchedStore();

    await store.activate('pl');

    expect(store.snapshot()).toEqual({ locale: 'pl', catalogues: { pl: CATALOGUES.pl } });
    expect(load).toHaveBeenCalledExactlyOnceWith('pl');
    expect(notified).toHaveBeenCalledOnce();
  });

  it('keeps its snapshot, and stays quiet, when the active locale is asked for again', async () => {
    const { store, notified } = createWatchedStore();
    await store.activate('pl');
    const before = store.snapshot();

    await store.activate('pl');

    expect(store.snapshot()).toBe(before);
    expect(notified).toHaveBeenCalledOnce();
  });

  it('ends on the locale asked for last when an earlier load finishes after it', async () => {
    const { store } = createWatchedStore();

    await Promise.all([store.activate('pl'), store.activate('en')]);

    expect(store.snapshot().locale).toBe('en');
  });

  it('stops telling a subscriber that unsubscribed', async () => {
    const { store } = createWatchedStore();
    const notified = vi.fn();
    const unsubscribe = store.subscribe(notified);

    unsubscribe();
    await store.activate('pl');

    expect(notified).not.toHaveBeenCalled();
  });
});
