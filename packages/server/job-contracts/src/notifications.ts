import type { VideoLifecycleEdge, VideoStatus, VideoVisibility } from '@vp/domain';
import { z } from 'zod';
import { defaultJobOptions, stagePolicies } from './policies';

/** The jobs on the `notify` queue that create notification rows, told apart by their name. */
export const NOTIFY_SUBSCRIBERS = 'notify-subscribers';
export const NOTIFY_COMMENT = 'notify-comment';
export const NOTIFY_PROCESSING = 'notify-processing';
export const NOTIFY_HEART = 'notify-heart';
export const NOTIFY_PARTY_INVITE = 'notify-party-invite';
export const NOTIFY_PARTY_REMINDER = 'notify-party-reminder';
export const NOTIFY_TEAM_INVITE = 'notify-team-invite';
export const NOTIFY_MODERATION = 'notify-moderation';
export const NOTIFY_POST_SUBSCRIBERS = 'notify-post-subscribers';
/** Not a notification row: tells each subscriber's open tabs, through `live.started`, right away. */
export const ANNOUNCE_LIVE = 'announce-live';

export const NotifySubscribersJob = z.object({
  kind: z.enum(['upload', 'live']),
  videoId: z.uuid(),
  /** The last subscriber of the batch before this one; absent on the first. */
  after: z.uuid().optional(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifySubscribersJob = z.infer<typeof NotifySubscribersJob>;

/** What the comment sits under; the `CommentTarget` of the domain, one literal per kind. */
const CommentTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('video'), id: z.uuid() }),
  z.object({ type: z.literal('post'), id: z.uuid() }),
  z.object({ type: z.literal('thread'), id: z.uuid() }),
]);

export const NotifyCommentJob = z.object({
  target: CommentTargetSchema,
  commentId: z.uuid(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyCommentJob = z.infer<typeof NotifyCommentJob>;

/** `held`, `approved` and `rejected` tell the owner how upload screening went; the others how processing ended. */
const PROCESSING_OUTCOMES = ['ready', 'failed', 'held', 'approved', 'rejected'] as const;

export const NotifyProcessingJob = z.object({
  videoId: z.uuid(),
  outcome: z.enum(PROCESSING_OUTCOMES),
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

export const NotifyPartyInviteJob = z.object({
  inviteId: z.uuid(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});

/** `before` goes out ten minutes ahead of the party, `start` at its time. */
export const PARTY_REMINDER_LEADS = ['before', 'start'] as const;
const PARTY_REMINDER_LEAD_MS = { before: 10 * 60_000, start: 0 } as const;

export const NotifyPartyReminderJob = z.object({
  roomId: z.uuid(),
  /** The instant the room was scheduled for when this job was enqueued; a job that no longer matches the room does nothing. */
  scheduledFor: z.iso.datetime(),
  lead: z.enum(PARTY_REMINDER_LEADS),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyPartyReminderJob = z.infer<typeof NotifyPartyReminderJob>;

export const NotifyTeamInviteJob = z.object({
  inviteId: z.uuid(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyPartyInviteJob = z.infer<typeof NotifyPartyInviteJob>;
export type NotifyTeamInviteJob = z.infer<typeof NotifyTeamInviteJob>;

export const NotifyModerationJob = z.object({
  /** The audit row of the action, so one action is one job however often it is enqueued. */
  eventId: z.uuid(),
  userId: z.uuid(),
  action: z.enum(['hold', 'hide', 'remove', 'ban']),
  channelId: z.uuid(),
  videoId: z.uuid().nullable(),
  commentId: z.uuid().nullable(),
  reason: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  excerpt: z.string().nullable(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyModerationJob = z.infer<typeof NotifyModerationJob>;

export const NotifyPostSubscribersJob = z.object({
  postId: z.uuid(),
  /** The last subscriber of the batch before this one; absent on the first. */
  after: z.uuid().optional(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type NotifyPostSubscribersJob = z.infer<typeof NotifyPostSubscribersJob>;

export const AnnounceLiveJob = z.object({
  liveStreamId: z.uuid(),
  /** The last subscriber of the batch before this one; absent on the first. */
  after: z.uuid().optional(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type AnnounceLiveJob = z.infer<typeof AnnounceLiveJob>;

const notificationJobIds = {
  subscribers: (videoId: string, kind: NotifySubscribersJob['kind'], after?: string) =>
    `${videoId}--${NOTIFY_SUBSCRIBERS}--${kind}${after ? `--${after}` : ''}`,
  announceLive: (liveStreamId: string, after?: string) =>
    `${liveStreamId}--${ANNOUNCE_LIVE}${after ? `--${after}` : ''}`,
  postSubscribers: (postId: string, after?: string) =>
    `${postId}--${NOTIFY_POST_SUBSCRIBERS}${after ? `--${after}` : ''}`,
  comment: (commentId: string) => `${commentId}--${NOTIFY_COMMENT}`,
  heart: (commentId: string) => `${commentId}--${NOTIFY_HEART}`,
  partyInvite: (inviteId: string) => `${inviteId}--${NOTIFY_PARTY_INVITE}`,
  partyReminder: (roomId: string, scheduledForMs: number, lead: NotifyPartyReminderJob['lead']) =>
    `${roomId}--${NOTIFY_PARTY_REMINDER}--${scheduledForMs}--${lead}`,
  teamInvite: (inviteId: string) => `${inviteId}--${NOTIFY_TEAM_INVITE}`,
  moderation: (eventId: string) => `${eventId}--${NOTIFY_MODERATION}`,
  processing: (videoId: string, outcome: NotifyProcessingJob['outcome']) =>
    `${videoId}--${NOTIFY_PROCESSING}--${outcome}`,
};

interface NotificationJob {
  name: string;
  data: unknown;
  jobId: string;
  /** Milliseconds the queue holds the job before it runs. */
  delay?: number;
}

/** The outbox row that enqueues a notification job once the change that caused it commits. */
export function notificationOutbox({ name, data, jobId, delay }: NotificationJob) {
  return {
    kind: 'notification',
    payload: {
      type: 'queue',
      queueName: 'notify',
      job: {
        name,
        data,
        opts: {
          jobId,
          ...(delay === undefined ? {} : { delay }),
          ...stagePolicies.notify,
          ...defaultJobOptions,
        },
      },
    },
  } as const;
}

export const subscribersOutbox = (job: NotifySubscribersJob) =>
  notificationOutbox({
    name: NOTIFY_SUBSCRIBERS,
    data: job,
    jobId: notificationJobIds.subscribers(job.videoId, job.kind, job.after),
  });

export const announceLiveOutbox = (job: AnnounceLiveJob) =>
  notificationOutbox({
    name: ANNOUNCE_LIVE,
    data: job,
    jobId: notificationJobIds.announceLive(job.liveStreamId, job.after),
  });

export const postSubscribersOutbox = (job: NotifyPostSubscribersJob) =>
  notificationOutbox({
    name: NOTIFY_POST_SUBSCRIBERS,
    data: job,
    jobId: notificationJobIds.postSubscribers(job.postId, job.after),
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

export const partyInviteOutbox = (job: NotifyPartyInviteJob) =>
  notificationOutbox({
    name: NOTIFY_PARTY_INVITE,
    data: job,
    jobId: notificationJobIds.partyInvite(job.inviteId),
  });

/**
 * The reminders of a scheduled room still ahead of `now`: ten minutes before and at the start. The
 * job id carries the instant, so a reschedule enqueues new ones and the old ones find the room moved.
 */
export function partyReminderOutboxes(roomId: string, scheduledFor: Date, now: Date) {
  return PARTY_REMINDER_LEADS.flatMap((lead) => {
    const delay = scheduledFor.getTime() - PARTY_REMINDER_LEAD_MS[lead] - now.getTime();
    return delay <= 0
      ? []
      : [
          notificationOutbox({
            name: NOTIFY_PARTY_REMINDER,
            data: { roomId, scheduledFor: scheduledFor.toISOString(), lead },
            jobId: notificationJobIds.partyReminder(roomId, scheduledFor.getTime(), lead),
            delay,
          }),
        ];
  });
}

export const teamInviteOutbox = (job: NotifyTeamInviteJob) =>
  notificationOutbox({
    name: NOTIFY_TEAM_INVITE,
    data: job,
    jobId: notificationJobIds.teamInvite(job.inviteId),
  });

export const moderationOutbox = (job: NotifyModerationJob) =>
  notificationOutbox({
    name: NOTIFY_MODERATION,
    data: job,
    jobId: notificationJobIds.moderation(job.eventId),
  });

const processingOutbox = (job: NotifyProcessingJob) =>
  notificationOutbox({
    name: NOTIFY_PROCESSING,
    data: job,
    jobId: notificationJobIds.processing(job.videoId, job.outcome),
  });

type TransitionNotifications = (
  videoId: string,
  visibility: VideoVisibility
) => ReturnType<typeof notificationOutbox>[];

const none: TransitionNotifications = () => [];
const owner =
  (outcome: NotifyProcessingJob['outcome']): TransitionNotifications =>
  (videoId) => [processingOutbox({ videoId, outcome })];

/**
 * What each edge tells people: the owner when processing ends or a reviewer acts, the subscribers
 * when it goes public. A live archive tells the subscribers nothing: they heard `live` when the
 * broadcast started.
 */
const NOTIFICATIONS_BY_EDGE = {
  reject: none,
  complete: none,
  abort: none,
  abandon: none,
  startProbe: none,
  completeProbe: none,
  failProbe: owner('failed'),
  completeThumbnail: none,
  package: (videoId, visibility) => [
    processingOutbox({ videoId, outcome: 'ready' }),
    ...(visibility === 'public' ? [subscribersOutbox({ kind: 'upload', videoId })] : []),
  ],
  fail: owner('failed'),
  reconcileFail: owner('failed'),
  reprocess: none,
  delete: none,
  takedown: owner('rejected'),
  finalizeLive: owner('ready'),
  failLive: owner('failed'),
  hold: owner('held'),
  approve: owner('approved'),
  rejectScreening: owner('rejected'),
  appeal: owner('held'),
} satisfies Record<VideoLifecycleEdge, TransitionNotifications>;

export function transitionNotificationJobs(
  videoId: string,
  edge: VideoLifecycleEdge,
  visibility: VideoVisibility
) {
  return NOTIFICATIONS_BY_EDGE[edge](videoId, visibility);
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
