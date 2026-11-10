import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { MediaTools } from '@vp/ffmpeg';
import { ThumbnailQueueJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { consuming } from '../consuming';
import { createChannelImageProcessor } from './channel-image';
import type { ProgressReporter, ProgressTarget } from './progress-reporter';
import { createThumbnailProcessor } from './thumbnail';
import { createThumbnailQueueProcessor } from './thumbnail-queue-processor';

export interface ThumbnailQueueStageDeps {
  config: AppConfig;
  repositories: Repositories;
  storage: StorageClient;
  media: MediaTools;
  metrics: PipelineMetrics;
  logger: Logger;
  workerId: string;
  progressReporter: (target: ProgressTarget) => ProgressReporter;
}

export function createThumbnailQueueStage(d: ThumbnailQueueStageDeps) {
  const { config } = d;
  const shared = {
    repositories: d.repositories,
    storage: d.storage,
    media: d.media,
    metrics: d.metrics,
    rawBucket: config.buckets.raw,
    publicBucket: config.buckets.public,
    logger: d.logger,
    tmpDir: config.worker.tmpDir,
    ffmpegPath: config.worker.ffmpegPath,
    ffmpegProcess: config.worker.ffmpegProcess,
  };
  return consuming(
    ThumbnailQueueJob,
    createThumbnailQueueProcessor({
      video: createThumbnailProcessor({
        ...shared,
        workerId: d.workerId,
        sprite: config.sprite,
        progressReporter: d.progressReporter,
      }),
      channelImage: createChannelImageProcessor({
        ...shared,
        cdn: config.cdn,
        ffprobePath: config.worker.ffprobePath,
      }),
    })
  );
}
