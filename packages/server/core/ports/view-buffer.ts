import type { ViewBatch, ViewCount, ViewDate } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface ViewEvent {
  readonly videoId: string;
  readonly viewerId: string;
  readonly viewDate: ViewDate;
  readonly watchSeconds: number;
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
  add(counts: readonly ViewCount[]): Promise<Result<void, CacheUnavailable>>;
  snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>>;
  release(batchId: string): Promise<Result<void, CacheUnavailable>>;
}
