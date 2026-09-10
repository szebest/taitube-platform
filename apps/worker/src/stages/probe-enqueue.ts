import type { FlowProducerPort, JobQueue, QueueJob } from '@vp/core/ports';
import type { ProbeMetadata } from '@vp/ffmpeg';
import {
  PackageJob,
  type ProbeJob,
  ThumbnailJob,
  TranscodeJob,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import type { Logger } from '@vp/observability';

export interface EnqueueFollowUpsParams {
  job: QueueJob<ProbeJob>;
  metadata: ProbeMetadata;
  priority: number;
  flowProducer?: FlowProducerPort;
  getQueue?: (name: string) => JobQueue;
  log: Logger;
}

export async function enqueueFollowUpJobs(params: EnqueueFollowUpsParams): Promise<void> {
  const { job, metadata, priority, flowProducer, getQueue, log } = params;
  const { videoId, sourceKey } = job.data;

  if (flowProducer) {
    const packageJobId = ids.package(videoId, job.data.generation);
    await flowProducer.add({
      name: 'package',
      queueName: 'package',
      data: PackageJob.parse({
        videoId,
        generation: job.data.generation,
        ladder: metadata.ladder,
        traceparent: job.data.traceparent,
      }),
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
            data: TranscodeJob.parse({
              videoId,
              sourceKey,
              generation: job.data.generation,
              rendition: r,
              fps: metadata.fps,
              durationMs: metadata.durationMs,
              traceparent: job.data.traceparent,
            }),
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
          data: ThumbnailJob.parse({
            videoId,
            sourceKey,
            generation: job.data.generation,
            durationMs: metadata.durationMs,
            traceparent: job.data.traceparent,
            ...(job.data.forceThumbnailFailure ? { forceFailure: true } : {}),
          }),
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
    log.info(
      { packageJobId, ladder: metadata.ladder.map((r) => r.name), priority },
      'Created BullMQ flow with package parent and transcode children'
    );
  } else if (getQueue) {
    const r720 = metadata.ladder.find((r) => r.name === '720p') || metadata.ladder[0];
    if (r720) {
      const transcodeQueueName = `transcode-${r720.name}`;
      const transcodeJobId = ids.transcode(videoId, r720.name, job.data.generation);
      const queue = getQueue(transcodeQueueName);
      await queue.add(
        transcodeQueueName,
        TranscodeJob.parse({
          videoId,
          sourceKey,
          generation: job.data.generation,
          rendition: r720,
          fps: metadata.fps,
          durationMs: metadata.durationMs,
          traceparent: job.data.traceparent,
        }),
        {
          jobId: transcodeJobId,
          priority,
          ...stagePolicies[transcodeQueueName as keyof typeof stagePolicies],
          ...defaultJobOptions,
        }
      );
      log.info(
        { transcodeJobId, queue: transcodeQueueName, priority },
        'Enqueued transcode follow-up job'
      );
    }

    const thumbnailQueue = getQueue('thumbnail');
    if (thumbnailQueue) {
      const thumbnailJobId = ids.thumbnail(videoId, job.data.generation);
      await thumbnailQueue.add(
        'thumbnail',
        ThumbnailJob.parse({
          videoId,
          sourceKey,
          generation: job.data.generation,
          durationMs: metadata.durationMs,
          traceparent: job.data.traceparent,
          ...(job.data.forceThumbnailFailure ? { forceFailure: true } : {}),
        }),
        {
          jobId: thumbnailJobId,
          priority,
          ...stagePolicies.thumbnail,
          ...defaultJobOptions,
        }
      );
      log.info(
        { thumbnailJobId, queue: 'thumbnail', priority },
        'Enqueued thumbnail follow-up job'
      );
    }
  }
}
