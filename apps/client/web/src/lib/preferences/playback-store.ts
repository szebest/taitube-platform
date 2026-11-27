import type { PlaybackPreferences } from '@vp/domain/settings';
import {
  defaultPlayback,
  mergedPlayback,
  readStoredPlayback,
  readStoredPlaybackRaw,
  STORAGE_PLAYBACK_KEY,
  writeStoredPlayback,
} from './device-preferences';

/**
 * The playback fields of one page as an external store: `useSyncExternalStore` reads the stored value after
 * hydration and the defaults before it. A write merges over what storage holds now; a browser that refuses
 * storage keeps the choice here, for this page.
 */
export class PlaybackStore {
  private readonly listeners = new Set<() => void>();
  private unsaved: string | null = null;
  private seen: { raw: string | null; value: PlaybackPreferences } | undefined;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    const onStorage = ({ key }: StorageEvent) => {
      if (key === STORAGE_PLAYBACK_KEY || key === null) listener();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      this.listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  };

  /** The same object until storage changes. */
  readonly snapshot = (): PlaybackPreferences => {
    const raw = readStoredPlaybackRaw() ?? this.unsaved;
    if (this.seen?.raw !== raw) {
      this.seen = { raw, value: readStoredPlayback(raw) };
    }
    return this.seen.value;
  };

  readonly serverSnapshot = defaultPlayback;

  save(patch: Partial<PlaybackPreferences>): PlaybackPreferences {
    const { json, playback } = mergedPlayback(readStoredPlaybackRaw() ?? this.unsaved, patch);
    this.unsaved = writeStoredPlayback(json) ? null : json;
    this.refresh();
    return playback;
  }

  /** Another tab may have changed the stored value: every reader looks again. */
  refresh(): void {
    for (const listener of this.listeners) listener();
  }
}
