import type { BufferedPlayhead } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * The write buffer in front of `watch_history`: playback heartbeats land here, and the database
 * sees a pause, an end, or a beat once `flushedAt` is a flush interval old. A miss is `ok(null)`.
 */
export interface PlayheadCachePort {
  read(userId: string, videoId: string): Promise<Result<BufferedPlayhead | null, CacheUnavailable>>;
  write(userId: string, playhead: BufferedPlayhead): Promise<Result<void, CacheUnavailable>>;
  forget(userId: string, videoIds: readonly string[]): Promise<Result<void, CacheUnavailable>>;
}
