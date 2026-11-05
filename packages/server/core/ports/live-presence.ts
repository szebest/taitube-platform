import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * Who is watching a stream, counted across pods. A viewer is present until it leaves or stops
 * touching for longer than the caller's window, so a pod that dies takes its viewers with it.
 */
export interface LivePresencePort {
  touch(
    liveStreamId: string,
    viewerIds: readonly string[],
    atMs: number
  ): Promise<Result<void, CacheUnavailable>>;
  leave(liveStreamId: string, viewerId: string): Promise<Result<void, CacheUnavailable>>;
  /** Viewers touched at or after `sinceMs`. */
  count(liveStreamId: string, sinceMs: number): Promise<Result<number, CacheUnavailable>>;
}
