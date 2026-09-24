import type { FlowProducerPort, JobQueue, QueueJob } from '@vp/core/ports';
import type { QueueUnavailable } from '@vp/errors';
import type { ProbeMetadata } from '@vp/ffmpeg';
import {
  type PackageJob,
  type ProbeJob,
  type ThumbnailJob,
  type TranscodeJob,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { type Result, isErr, ok } from '@vp/result';

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
          const transcodeJobId = ids.transcode(videoId, r.name, job.data.generation);
          return {
            name: queueName,
            queueName,
            data: {
              videoId,
              sourceKey,
              generation: job.data.generation,
              rendition: r,
              fps: metadata.fps,
              durationMs: metadata.durationMs,
              traceparent: job.data.traceparent,
              requestId: job.data.requestId,
            } satisfies TranscodeJob,
            opts: {
              jobId: transcodeJobId,
              priority,
              ...stagePolicies[queueName as keyof typeof stagePolicies],
              ...defaultJobOptions,
              failParentOnFailure: true,
              removeDependencyOnFailure: false,
            },
          };
        }),
        {
          name: 'thumbnail',
          queueName: 'thumbnail',
          data: {
            videoId,
            sourceKey,
            generation: job.data.generation,
            durationMs: metadata.durationMs,
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
          durationMs: metadata.durationMs,
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
