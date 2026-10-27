import type { ViewBufferPort } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { type Result, isErr, ok } from '@vp/result';

export interface FlushVideoRetentionOptions {
  repositories: Repositories;
  viewBuffer: ViewBufferPort;
  logger?: Logger;
}

/**
 * Drains the buffered retention steps into Postgres. A step is a statistic, so a drain whose apply
 * fails is lost rather than ledgered like a view batch.
 */
export async function runFlushVideoRetention(
  options: FlushVideoRetentionOptions
): Promise<Result<{ steps: number }, CacheUnavailable | DatabaseUnavailable>> {
  const { repositories, viewBuffer, logger } = options;

  const drained = await viewBuffer.drainRetention();
  if (isErr(drained)) return drained;
  if (drained.value.length === 0) return ok({ steps: 0 });

  const applied = await repositories.videoViews.applyRetention(drained.value);
  if (isErr(applied)) return applied;

  logger?.info({ steps: drained.value.length }, 'flushed buffered video retention');
  return ok({ steps: drained.value.length });
}
