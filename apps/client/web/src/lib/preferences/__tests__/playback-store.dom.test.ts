import { DEFAULT_DEVICE_PREFERENCES } from '#app/__tests__/device-preferences-fixtures';
import { STORAGE_PLAYBACK_KEY, saveStoredPlayback } from '../device-preferences';
import { PlaybackStore } from '../playback-store';

const DEFAULT_PLAYBACK = DEFAULT_DEVICE_PREFERENCES.playback;

describe('apps/client/web: the playback store', () => {
  it('serves the defaults to the server render, and what storage holds to the page', () => {
    saveStoredPlayback({ speed: 1.5 });
    const store = new PlaybackStore();

    expect(store.serverSnapshot()).toEqual(DEFAULT_PLAYBACK);
    expect(store.snapshot().speed).toBe(1.5);
  });

  it('hands out the same object until storage changes', () => {
    const store = new PlaybackStore();
    const first = store.snapshot();

    expect(store.snapshot()).toBe(first);
    saveStoredPlayback({ speed: 2 });
    expect(store.snapshot()).not.toBe(first);
  });

  it('tells its readers of a write, merged over what is stored now', () => {
    const store = new PlaybackStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    saveStoredPlayback({ speed: 2 });

    const saved = store.save({ statsOverlay: true });

    expect(saved).toMatchObject({ speed: 2, statsOverlay: true });
    expect(listener).toHaveBeenCalledOnce();
    stop();
    store.save({ statsOverlay: false });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('looks again when another tab writes the stored document, and for no other key', () => {
    const store = new PlaybackStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_PLAYBACK_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'vp.other' }));

    expect(listener).toHaveBeenCalledOnce();
    stop();
  });

  it('keeps a choice for this page when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const store = new PlaybackStore();

    store.save({ speed: 1.5 });

    expect(store.snapshot().speed).toBe(1.5);
  });
});
