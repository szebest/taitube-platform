import type { VideoStatus, VideoVisibility } from '@vp/domain';
import { z } from 'zod';
import { defaultJobOptions, stagePolicies } from './policies';

/** The jobs on the `notify` queue that create notification rows, told apart by their name. */
export const NOTIFY_SUBSCRIBERS = 'notify-subscribers';
export const NOTIFY_COMMENT = 'notify-comment';
export const NOTIFY_PROCESSING = 'notify-processing';
export const NOTIFY_HEART = 'notify-heart';

export const NotifySubscribersJob = z.object({
  kind: z.enum(['upload', 'live']),
  videoId: z.uuid(),
  /** The last subscriber of the batch before this one; absent on the first. */
  after: z.uuid().optional(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifySubscribersJob = z.infer<typeof NotifySubscribersJob>;

export const NotifyCommentJob = z.object({
  videoId: z.uuid(),
  commentId: z.uuid(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyCommentJob = z.infer<typeof NotifyCommentJob>;

export const NotifyProcessingJob = z.object({
  videoId: z.uuid(),
  outcome: z.enum(['ready', 'failed']),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyProcessingJob = z.infer<typeof NotifyProcessingJob>;

export const NotifyHeartJob = z.object({
  videoId: z.uuid(),
  commentId: z.uuid(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyHeartJob = z.infer<typeof NotifyHeartJob>;

const notificationJobIds = {
  subscribers: (videoId: string, kind: NotifySubscribersJob['kind'], after?: string) =>
    `${videoId}--${NOTIFY_SUBSCRIBERS}--${kind}${after ? `--${after}` : ''}`,
  comment: (commentId: string) => `${commentId}--${NOTIFY_COMMENT}`,
  heart: (commentId: string) => `${commentId}--${NOTIFY_HEART}`,
  processing: (videoId: string, outcome: NotifyProcessingJob['outcome']) =>
    `${videoId}--${NOTIFY_PROCESSING}--${outcome}`,
};

interface NotificationJob {
  name: string;
  data: unknown;
  jobId: string;
}

/** The outbox row that enqueues a notification job once the change that caused it commits. */
export function notificationOutbox({ name, data, jobId }: NotificationJob) {
  return {
    kind: 'notification',
    payload: {
      type: 'queue',
      queueName: 'notify',
      job: { name, data, opts: { jobId, ...stagePolicies.notify, ...defaultJobOptions } },
    },
  } as const;
}

export const subscribersOutbox = (job: NotifySubscribersJob) =>
  notificationOutbox({
    name: NOTIFY_SUBSCRIBERS,
    data: job,
    jobId: notificationJobIds.subscribers(job.videoId, job.kind, job.after),
  });

export const commentOutbox = (job: NotifyCommentJob) =>
  notificationOutbox({
    name: NOTIFY_COMMENT,
    data: job,
    jobId: notificationJobIds.comment(job.commentId),
  });

export const heartOutbox = (job: NotifyHeartJob) =>
  notificationOutbox({
    name: NOTIFY_HEART,
    data: job,
    jobId: notificationJobIds.heart(job.commentId),
  });

const processingOutbox = (job: NotifyProcessingJob) =>
  notificationOutbox({
    name: NOTIFY_PROCESSING,
    data: job,
    jobId: notificationJobIds.processing(job.videoId, job.outcome),
  });

/** What a status change tells people: the owner when it ends, the subscribers when it goes public. */
export function transitionNotificationJobs(
  videoId: string,
  status: VideoStatus,
  visibility: VideoVisibility
) {
  switch (status) {
    case 'READY':
      return [
        processingOutbox({ videoId, outcome: 'ready' }),
        ...(visibility === 'public' ? [subscribersOutbox({ kind: 'upload', videoId })] : []),
      ];
    case 'FAILED':
      return [processingOutbox({ videoId, outcome: 'failed' })];
    default:
      return [];
  }
}

/** A ready video that was not public and now is: the subscribers hear about it then. */
export function visibilityNotificationJobs(
  videoId: string,
  status: VideoStatus,
  before: VideoVisibility,
  after: VideoVisibility
) {
  return status === 'READY' && before !== 'public' && after === 'public'
    ? [subscribersOutbox({ kind: 'upload', videoId })]
    : [];
}
