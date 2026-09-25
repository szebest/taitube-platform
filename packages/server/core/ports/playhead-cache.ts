import type { WatchProgress } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * The write buffer in front of `watch_history`: playback heartbeats land here, and the database
 * only sees a pause, an end or the first beat of a session. A miss is `ok(null)`.
 */
export interface PlayheadCachePort {
  read(userId: string, videoId: string): Promise<Result<WatchProgress | null, CacheUnavailable>>;
  write(userId: string, progress: WatchProgress): Promise<Result<void, CacheUnavailable>>;
  forget(userId: string, videoIds: readonly string[]): Promise<Result<void, CacheUnavailable>>;
}
