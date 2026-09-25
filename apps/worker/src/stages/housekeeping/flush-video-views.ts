import type { ViewBufferPort } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface FlushVideoViewsOptions {
  repositories: Repositories;
  viewBuffer: ViewBufferPort;
  metrics: PipelineMetrics;
  now: () => number;
  batchRetentionMs: number;
  logger?: Logger;
}

export type FlushVideoViewsResult =
  | { type: 'idle' }
  | { type: 'applied'; batchId: string; views: number }
  | { type: 'already-applied'; batchId: string };

/**
 * Drains the view buffer into Postgres. The batch is released only after it commits, and the
 * commit records the batch id, so a flush that dies at any step leaves a batch the next run
 * either applies or recognises as applied: views are neither lost nor counted twice.
 */
export async function runFlushVideoViews(
  options: FlushVideoViewsOptions
): Promise<Result<FlushVideoViewsResult, CacheUnavailable | DatabaseUnavailable>> {
  const { repositories, viewBuffer, metrics, now, batchRetentionMs, logger } = options;
  const startedAt = now();

  const snapshot = await viewBuffer.snapshot(uuidv7());
  if (isErr(snapshot)) return snapshot;
  const batch = snapshot.value;

  let flushed: FlushVideoViewsResult = { type: 'idle' };
  if (batch) {
    const applied = await repositories.videoViews.applyBatch(batch);
    if (isErr(applied)) return applied;

    const released = await viewBuffer.release(batch.batchId);
    if (isErr(released)) return released;

    const outcome = applied.value;
    flushed =
      outcome.type === 'applied'
        ? { type: 'applied', batchId: batch.batchId, views: outcome.views }
        : { type: 'already-applied', batchId: batch.batchId };
    if (outcome.type === 'applied') metrics.viewsFlushed.inc(outcome.views);
    logger?.info(flushed, 'flushed buffered video views');
  }

  const forgotten = await repositories.videoViews.forgetBatchesBefore(
    new Date(startedAt - batchRetentionMs)
  );
  if (isErr(forgotten)) return forgotten;

  metrics.viewFlushDuration.observe((now() - startedAt) / MS_PER_SECOND);
  return ok(flushed);
}
