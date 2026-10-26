import type { RetentionCount, ViewBatch, ViewDate } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface ViewEvent {
  readonly videoId: string;
  readonly viewerId: string;
  readonly viewDate: ViewDate;
  readonly watchSeconds: number;
}

export interface RetentionMilestone {
  readonly videoId: string;
  readonly sessionId: string;
  readonly percent: number;
}

/** `deferred` is held in process until the buffer is reachable; `dropped` found that hold full. */
export type ViewRecordOutcome = 'counted' | 'duplicate' | 'deferred' | 'dropped';

/**
 * Where playback beacons accumulate between flushes, so a view costs no database connection.
 * `snapshot` moves everything buffered so far under the batch id and hands back the batch still
 * pending from an earlier flush if one never released, which is what makes a crash mid-flush lose
 * nothing; `release` is called only once the batch is durable elsewhere.
 */
export interface ViewBufferPort {
  record(view: ViewEvent): Promise<Result<ViewRecordOutcome, CacheUnavailable>>;
  /** Records each view as `record` would, in one round trip; outcomes follow the input order. */
  recordAll(views: readonly ViewEvent[]): Promise<Result<ViewRecordOutcome[], CacheUnavailable>>;
  snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>>;
  release(batchId: string): Promise<Result<void, CacheUnavailable>>;
  /**
   * Counts the session at every 5 percent step from where it last was up to `percent`, so a
   * session adds one viewer to each step it reaches however many beacons it sends.
   */
  recordRetention(milestone: RetentionMilestone): Promise<Result<void, CacheUnavailable>>;
  /** Hands back the buffered steps and empties the buffer; steps drained and not applied are lost. */
  drainRetention(): Promise<Result<RetentionCount[], CacheUnavailable>>;
}
