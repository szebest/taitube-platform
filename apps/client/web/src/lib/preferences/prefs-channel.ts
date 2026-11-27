import { STORAGE_PLAYBACK_KEY } from './device-preferences';

const CHANNEL_NAME = 'vp.prefs';

/** A field another tab changed: `playback.speed`, `locale` or `appearance`, with the value it took. */
export type PrefMessage = Readonly<{ field: string; value: unknown }>;

/** Tells the other tabs of this browser; a cookie raises no event, so this is how they learn of one. */
export function postPref(message: PrefMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(message);
  channel.close();
}

/**
 * Hears the other tabs. Storage-backed fields also arrive through the `storage` event, the fallback for a
 * browser with no `BroadcastChannel`, as the `playback` field with no value: the listener re-reads storage.
 */
export function subscribePrefs(listener: (message: PrefMessage) => void): () => void {
  const source =
    typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(CHANNEL_NAME);
  const fromChannel = ({ data }: MessageEvent<PrefMessage>) => listener(data);
  const fromStorage = ({ key }: StorageEvent) => {
    if (key === STORAGE_PLAYBACK_KEY && source === undefined) {
      listener({ field: 'playback', value: undefined });
    }
  };
  source?.addEventListener('message', fromChannel);
  window.addEventListener('storage', fromStorage);

  return () => {
    source?.removeEventListener('message', fromChannel);
    source?.close();
    window.removeEventListener('storage', fromStorage);
  };
}
