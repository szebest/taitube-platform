import type { FlowProducerPort, JobQueue, QueueJob } from '@vp/core/ports';
import type { NewOutboxInput, Repositories } from '@vp/core/repositories';
import { autoCaptionsEnabled } from '@vp/domain';
import type { CaptionsConfig } from '@vp/env-schema';
import type { DatabaseUnavailable, QueueUnavailable } from '@vp/errors';
import type { ProbeMetadata } from '@vp/ffmpeg';
import {
  captionsFlow,
  chunkCountFor,
  defaultJobOptions,
  ids,
  type PackageJob,
  type ProbeJob,
  stagePolicies,
  type ThumbnailJob,
  type TranscodeJob,
} from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { isErr, ok, type Result } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface EnqueueFollowUpsParams {
  job: QueueJob<ProbeJob>;
  metadata: ProbeMetadata;
  priority: number;
  flowProducer?: FlowProducerPort;
  getQueue?: (name: string) => JobQueue;
  log: Logger;
}

export async function enqueueFollowUpJobs(
  params: EnqueueFollowUpsParams
): Promise<Result<void, QueueUnavailable>> {
  const { job, metadata, priority, flowProducer, getQueue, log } = params;
  const { videoId, sourceKey } = job.data;

  if (flowProducer) {
    const packageJobId = ids.package(videoId, job.data.generation);
    const flow = await flowProducer.add({
      name: 'package',
      queueName: 'package',
      data: {
        videoId,
        generation: job.data.generation,
        ladder: metadata.ladder,
        traceparent: job.data.traceparent,
        requestId: job.data.requestId,
      } satisfies PackageJob,
      opts: {
        jobId: packageJobId,
        priority,
        ...stagePolicies.package,
        ...defaultJobOptions,
      },
      children: [
        ...metadata.ladder.map((r) => {
          const queueName = `transcode-${r.name}` as const;
          const data = {
            videoId,
            sourceKey,
            generation: job.data.generation,
            rendition: r,
            fps: metadata.fps,
            durationMs: metadata.durationMs,
            traceparent: job.data.traceparent,
            requestId: job.data.requestId,
          } satisfies TranscodeJob;
          const opts = {
            priority,
            ...stagePolicies[queueName as keyof typeof stagePolicies],
            ...defaultJobOptions,
            failParentOnFailure: true,
            removeDependencyOnFailure: false,
          };
          const chunkCount = chunkCountFor(metadata.durationMs);
          return {
            name: queueName,
            queueName,
            data: chunkCount === undefined ? data : { ...data, chunkCount },
            opts: { ...opts, jobId: ids.transcode(videoId, r.name, job.data.generation) },
            children:
              chunkCount === undefined
                ? undefined
                : Array.from({ length: chunkCount }, (_, chunkIndex) => ({
                    name: queueName,
                    queueName,
                    data: { ...data, chunkCount, chunkIndex } satisfies TranscodeJob,
                    opts: {
                      ...opts,
                      jobId: ids.transcodeChunk(videoId, r.name, chunkIndex, job.data.generation),
                    },
                  })),
          };
        }),
        {
          name: 'thumbnail',
          queueName: 'thumbnail',
          data: {
            videoId,
            sourceKey,
            generation: job.data.generation,
            durationMs: metadata.videoDurationMs,
            traceparent: job.data.traceparent,
            requestId: job.data.requestId,
          } satisfies ThumbnailJob,
          opts: {
            jobId: ids.thumbnail(videoId, job.data.generation),
            priority,
            ...stagePolicies.thumbnail,
            ...defaultJobOptions,
            failParentOnFailure: false,
            ignoreDependencyOnFailure: true,
          },
        },
      ],
    });
    if (isErr(flow)) return flow;

    log.info(
      { packageJobId, ladder: metadata.ladder.map((r) => r.name), priority },
      'created BullMQ flow with package parent and transcode children'
    );
    return ok();
  }

  if (getQueue) {
    const r720 = metadata.ladder.find((r) => r.name === '720p') || metadata.ladder[0];
    if (r720) {
      const transcodeQueueName = `transcode-${r720.name}`;
      const transcodeJobId = ids.transcode(videoId, r720.name, job.data.generation);
      const queue = getQueue(transcodeQueueName);
      const enqueued = await queue.add(
        transcodeQueueName,
        {
          videoId,
          sourceKey,
          generation: job.data.generation,
          rendition: r720,
          fps: metadata.fps,
          durationMs: metadata.durationMs,
          traceparent: job.data.traceparent,
          requestId: job.data.requestId,
        } satisfies TranscodeJob,
        {
          jobId: transcodeJobId,
          priority,
          ...stagePolicies[transcodeQueueName as keyof typeof stagePolicies],
          ...defaultJobOptions,
        }
      );
      if (isErr(enqueued)) return enqueued;

      log.info(
        { transcodeJobId, queue: transcodeQueueName, priority },
        'enqueued transcode follow-up job'
      );
    }

    const thumbnailQueue = getQueue('thumbnail');
    if (thumbnailQueue) {
      const thumbnailJobId = ids.thumbnail(videoId, job.data.generation);
      const enqueued = await thumbnailQueue.add(
        'thumbnail',
        {
          videoId,
          sourceKey,
          generation: job.data.generation,
          durationMs: metadata.videoDurationMs,
          traceparent: job.data.traceparent,
          requestId: job.data.requestId,
        } satisfies ThumbnailJob,
        {
          jobId: thumbnailJobId,
          priority,
          ...stagePolicies.thumbnail,
          ...defaultJobOptions,
        }
      );
      if (isErr(enqueued)) return enqueued;

      log.info(
        { thumbnailJobId, queue: 'thumbnail', priority },
        'enqueued thumbnail follow-up job'
      );
    }
  }

  return ok();
}

export interface CaptionsEnqueueParams {
  repositories: Repositories;
  captions: Pick<CaptionsConfig, 'enabled' | 'modelVersion'>;
  job: QueueJob<ProbeJob>;
  metadata: Pick<ProbeMetadata, 'audioCodec' | 'durationMs'>;
}

/**
 * The outbox entry that starts a video's captions run, committed with `PROBING -> PROCESSING`. It
 * is a flow of its own on the `captions` queue, never a child of `package`, so `READY` never waits
 * for it. A video with captions on but no audio gets a `disabled` track and no run.
 */
export async function captionsOutboxEntry(
  params: CaptionsEnqueueParams
): Promise<Result<NewOutboxInput | undefined, DatabaseUnavailable>> {
  const { repositories, captions, job, metadata } = params;
  const { videoId, sourceKey } = job.data;
  if (!captions.enabled) return ok(undefined);

  const settings = await repositories.captions.settings(videoId);
  if (isErr(settings)) return settings;
  const wanted =
    settings.value &&
    autoCaptionsEnabled(settings.value.autoCaptions, settings.value.channelDefault);
  if (!wanted) return ok(undefined);

  const silent = !metadata.audioCodec;
  const track = await repositories.captions.createGenerated({
    id: uuidv7(),
    videoId,
    language: null,
    modelVersion: captions.modelVersion,
    status: silent ? 'disabled' : 'pending',
    reason: silent ? 'NO_AUDIO' : null,
  });
  if (isErr(track)) return track;
  if (track.value.status !== 'pending') return ok(undefined);

  return ok({
    kind: 'captions',
    payload: {
      type: 'flow',
      flow: captionsFlow({
        videoId,
        captionId: track.value.id,
        captionVersion: track.value.version,
        sourceKey,
        durationMs: metadata.durationMs,
        modelVersion: track.value.modelVersion ?? captions.modelVersion,
        language: track.value.language,
        traceparent: job.data.traceparent,
        requestId: job.data.requestId,
      }),
    },
  });
}
