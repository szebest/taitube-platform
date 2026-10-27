import type { Repositories } from '@vp/core/repositories';
import type { CaptionsConfig } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { captionsFlow } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, isErr, ok } from '@vp/result';

export interface ReconcileCaptionsOptions {
  repositories: Repositories;
  metrics: PipelineMetrics;
  captions: Pick<CaptionsConfig, 'enabled' | 'modelVersion'>;
  thresholdMs: number;
  scanLimit: number;
  logger?: Logger;
}

/**
 * ADR-16's reconciler for captions: a generated track still `pending` an hour after it was asked for
 * lost its enqueue (or its queue was drained), so its run is enqueued again under the same job id,
 * which BullMQ refuses as a duplicate when the first one is still there.
 */
export async function runReconcileCaptions(
  options: ReconcileCaptionsOptions
): Promise<Result<{ requeued: number }, DatabaseUnavailable>> {
  const { repositories, metrics, captions, thresholdMs, scanLimit, logger } = options;
  if (!captions.enabled) return ok({ requeued: 0 });

  const stale = await repositories.captions.listStalePending(thresholdMs, scanLimit);
  if (isErr(stale)) return stale;

  let requeued = 0;
  for (const track of stale.value) {
    const found = await repositories.videos.findById(track.videoId);
    if (isErr(found)) return found;
    const video = found.value;
    if (!video?.durationMs || video.status === 'DELETED') continue;

    const enqueued = await repositories.outbox.enqueue({
      kind: 'captions',
      payload: {
        type: 'flow',
        flow: captionsFlow({
          videoId: video.id,
          captionId: track.id,
          captionVersion: track.version,
          sourceKey: video.sourceKey,
          durationMs: video.durationMs,
          modelVersion: track.modelVersion ?? captions.modelVersion,
          language: track.language,
          traceparent: '',
        }),
      },
    });
    if (isErr(enqueued)) return enqueued;

    requeued += 1;
    metrics.reconcilerRepairsTotal.inc({ type: 'captions' });
    logger?.info({ videoId: video.id, captionId: track.id }, 're-enqueued a stuck captions run');
  }
  return ok({ requeued });
}
