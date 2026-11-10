import { STORAGE_PLAYBACK_KEY } from '../device-preferences';
import { type PrefMessage, postPref, subscribePrefs } from '../prefs-channel';

class FakeChannel extends EventTarget {
  static all: FakeChannel[] = [];
  constructor() {
    super();
    FakeChannel.all.push(this);
  }
  close() {
    FakeChannel.all = FakeChannel.all.filter((peer) => peer !== this);
  }
  postMessage(data: PrefMessage) {
    for (const other of FakeChannel.all.filter((peer) => peer !== this)) {
      other.dispatchEvent(new MessageEvent('message', { data }));
    }
  }
}

describe('apps/client/web: the preferences channel', () => {
  afterEach(() => {
    FakeChannel.all = [];
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('hands the other channels a field and its value, until the listener stops', async () => {
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    const { postPref: send, subscribePrefs: listen } = await import('../prefs-channel');
    const heard = vi.fn();
    const stop = listen(heard);
    const other = new FakeChannel();

    send({ field: 'playback.speed', value: 1.5 });
    expect(heard).toHaveBeenCalledExactlyOnceWith({ field: 'playback.speed', value: 1.5 });

    other.postMessage({ field: 'locale', value: 'sv-FI' });
    expect(heard).toHaveBeenLastCalledWith({ field: 'locale', value: 'sv-FI' });

    stop();
    other.postMessage({ field: 'locale', value: null });
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('falls back to the storage event for the playback fields where there is no channel', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const heard = vi.fn();
    const stop = subscribePrefs(heard);

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_PLAYBACK_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'vp.other' }));

    expect(heard).toHaveBeenCalledExactlyOnceWith({ field: 'playback', value: undefined });
    stop();
    postPref({ field: 'locale', value: null });
  });
});
