import { LOCALE_DETAILS } from '@vp/messages';
import { createLocaleStore } from '../locale-store';

function createWatchedStore() {
  const store = createLocaleStore();
  const notified = vi.fn();
  store.subscribe(notified);
  return { store, notified };
}

describe('@vp/intl-react: createLocaleStore', () => {
  it('starts on en with no translation loaded', () => {
    expect(createLocaleStore().snapshot()).toEqual({ locale: 'en', catalogues: {} });
  });

  it('loads the catalogue of the locale it activates, and tells its subscribers', async () => {
    const { store, notified } = createWatchedStore();

    await store.activate('pl');

    expect(store.snapshot()).toEqual({
      locale: 'pl',
      catalogues: { pl: await LOCALE_DETAILS.pl.load() },
    });
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
    const store = createLocaleStore();
    const notified = vi.fn();
    const unsubscribe = store.subscribe(notified);

    unsubscribe();
    await store.activate('pl');

    expect(notified).not.toHaveBeenCalled();
  });
});
