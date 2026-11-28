import type { Result } from '@kit/result';
import type { CacheUnavailable } from '@vp/errors';

export interface FixedWindowHit {
  /** Hits in the open window, this one included. */
  count: number;
  /** Milliseconds until the window closes and the count starts over. */
  resetInMs: number;
}

/**
 * Counts hits per key in a window that opens with the first hit and does not slide, shared by every
 * process that holds the port, so a limit holds however many API replicas serve the caller.
 */
export interface FixedWindowCounterPort {
  hit(key: string, windowMs: number): Promise<Result<FixedWindowHit, CacheUnavailable>>;
}
