import type { QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { AnyFailure } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import { type ChannelImageJob, ThumbnailQueueJob, type VideoThumbnailJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, assertNever } from '@vp/result';
import { consuming } from '../consuming';
import { createChannelImageProcessor } from './channel-image';
import type { ProgressReporter, ProgressTarget } from './progress-reporter';
import { createThumbnailProcessor } from './thumbnail';

type Processor<T> = (job: QueueJob<T>) => Promise<Result<unknown, AnyFailure>>;

export interface ThumbnailQueueProcessors {
  video: Processor<VideoThumbnailJob>;
  channelImage: Processor<ChannelImageJob>;
}

/** The thumbnail queue carries video thumbnails and channel images; the payload's `type` picks the stage. */
export function createThumbnailQueueProcessor({ video, channelImage }: ThumbnailQueueProcessors) {
  return (job: QueueJob<ThumbnailQueueJob>): Promise<Result<unknown, AnyFailure>> => {
    const { data } = job;
    switch (data.type) {
      case 'video-thumbnail':
        return video({ ...job, data });
      case 'channel-image':
        return channelImage({ ...job, data });
      default:
        return assertNever(data, 'createThumbnailQueueProcessor');
    }
  };
}

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
