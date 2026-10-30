import {
  InMemoryCacheClient,
  InMemoryMultipartStorage,
  InMemoryViewBuffer,
} from '@vp/adapters/in-memory';
import { RedisReactionCacheAdapter } from '@vp/adapters/redis/redis-reaction-cache.adapter';
import type { CacheClient, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { asCdnBase, inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import { speechTools } from '@vp/whisper';
import * as ffmpeg from '@vp/ffmpeg';
import type { Logger } from '@vp/logger';
import { createMetricsRegistry } from '@vp/observability';
import { everyInterval } from '../heartbeat';
import type { StageDefinition } from '../registry';
import { housekeepingTasks } from '../stages/housekeeping/index';
import type { TranscodeProcessorDeps } from '../stages/transcode';
import { transcodeCollaborators } from '../transcode-collaborators';
import type { FlowWorld } from './flow-harness';

const config = inProcessAppConfig();

/**
 * The real FFmpeg, looked up on every call so a spec that still spies on `@vp/ffmpeg` sees its spy.
 * A new spec hands the stage a `MediaTools` double instead.
 */
const mediaTools: MediaTools = {
  probe: (...args) => ffmpeg.runFfprobe(...args),
  transcode: (...args) => ffmpeg.runFfmpegTranscode(...args),
  thumbnail: (...args) => ffmpeg.runFfmpegThumbnail(...args),
  transcodeChunk: (...args) => ffmpeg.runFfmpegChunk(...args),
  concat: (...args) => ffmpeg.runFfmpegConcat(...args),
  audio: (...args) => ffmpeg.runFfmpegAudio(...args),
};

/** The configuration a stage reads, at the values `.env.example` gives a local process. */
export const STAGE_SETTINGS = {
  rawBucket: 'raw',
  publicBucket: 'public',
  cdn: asCdnBase('http://localhost:9000/public'),
  sprite: config.sprite,
  ffmpegProcess: config.worker.ffmpegProcess,
  ffmpeg: {
    path: config.worker.ffmpegPath,
    threads: 2,
    preset: 'veryfast',
    gopSeconds: config.worker.gopSeconds,
    hlsSegmentSeconds: config.worker.hlsSegmentSeconds,
    timeoutFactor: config.worker.jobTimeoutFactor,
    minTimeoutMs: config.worker.ffmpegProcess.minTranscodeTimeoutMs,
    limits: config.worker.ffmpegProcess,
  },
  ffmpegPath: config.worker.ffmpegPath,
  ffprobePath: config.worker.ffprobePath,
  maxDurationSeconds: config.limits.maxDurationSeconds,
  retentionDays: 7,
  maxInflightPerUser: 3,
  tmpDir: '/tmp/vp',
  housekeeping: config.housekeeping,
  views: config.views,
  captions: config.captions,
  workerId: 'worker-spec',
  metrics: createMetricsRegistry(),
  media: mediaTools,
  speech: speechTools,
  now: Date.now,
};

export const TASKS = housekeepingTasks(config.housekeeping);

export interface TranscodeParts {
  repositories: Repositories;
  storage: StorageClient;
  logger: Logger;
  cache?: CacheClient;
  media?: MediaTools;
}

/** A transcode wired the way the registry wires one, over the doubles a spec hands it. */
export function transcodeDeps(parts: TranscodeParts): TranscodeProcessorDeps {
  const { repositories, storage, logger, cache = new InMemoryCacheClient() } = parts;
  return {
    ...STAGE_SETTINGS,
    repositories,
    storage,
    logger,
    media: parts.media ?? mediaTools,
    ...transcodeCollaborators({
      config,
      repositories,
      storage,
      cache,
      metrics: STAGE_SETTINGS.metrics,
      now: Date.now,
      every: everyInterval,
    }),
  };
}

/** FFmpeg for every rendition but `rendition`, whose transcode fails the way a crashed encode does. */
export function failingTranscodeOf(rendition: string): MediaTools {
  return {
    ...mediaTools,
    transcode: (options) =>
      options.rendition.name === rendition
        ? Promise.reject(
            new PermanentError(ErrorCodes.FFMPEG_FAILED, `FFmpeg failed for transcode-${rendition}`)
          )
        : mediaTools.transcode(options),
  };
}

export const failingThumbnails: MediaTools = {
  ...mediaTools,
  thumbnail: () =>
    Promise.reject(new PermanentError(ErrorCodes.FFMPEG_FAILED, 'FFmpeg failed for thumbnails')),
};

/** What the registry hands a stage, over the doubles of a `flowWorld`. */
export function registryDeps(
  world: Pick<FlowWorld, 'repositories' | 'storage' | 'getQueue' | 'flowProducer' | 'logger'>,
  media: MediaTools
): Parameters<StageDefinition['createProcessor']>[0] {
  const cache = new InMemoryCacheClient();
  return {
    ...world,
    config,
    multipart: new InMemoryMultipartStorage(world.storage),
    cache,
    reactionCache: new RedisReactionCacheAdapter({
      ...config.caches.reactions,
      backend: { type: 'cache', cache },
    }),
    viewBuffer: new InMemoryViewBuffer(),
    metrics: STAGE_SETTINGS.metrics,
    media,
    speech: STAGE_SETTINGS.speech,
    workerId: STAGE_SETTINGS.workerId,
    now: Date.now,
    every: everyInterval,
  };
}
