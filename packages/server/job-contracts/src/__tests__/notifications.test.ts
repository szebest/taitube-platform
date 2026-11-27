import {
  ANNOUNCE_LIVE,
  AnnounceLiveJob,
  announceLiveOutbox,
  commentOutbox,
  heartOutbox,
  moderationOutbox,
  teamInviteOutbox,
  NOTIFY_COMMENT,
  NOTIFY_HEART,
  NOTIFY_MODERATION,
  NOTIFY_PARTY_INVITE,
  NOTIFY_POST_SUBSCRIBERS,
  NOTIFY_TEAM_INVITE,
  NOTIFY_PROCESSING,
  NOTIFY_SUBSCRIBERS,
  NotifyCommentJob,
  NotifyHeartJob,
  NotifyModerationJob,
  NotifyPartyInviteJob,
  NotifyTeamInviteJob,
  NotifyProcessingJob,
  NotifySubscribersJob,
  partyInviteOutbox,
  postSubscribersOutbox,
  subscribersOutbox,
  transitionNotificationJobs,
  visibilityNotificationJobs,
} from '../notifications';
import { defaultJobOptions, stagePolicies } from '../policies';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000a1';
const COMMENT_ID = '00000000-0000-7000-8000-0000000000b1';
const INVITE_ID = '00000000-0000-7000-8000-0000000000d1';
const EVENT_ID = '00000000-0000-7000-8000-0000000000e1';
const AFTER = '00000000-0000-7000-8000-0000000000c1';

const MODERATION = {
  eventId: EVENT_ID,
  userId: VIDEO_ID,
  action: 'remove',
  channelId: COMMENT_ID,
  videoId: VIDEO_ID,
  commentId: COMMENT_ID,
  reason: 'spam',
  expiresAt: null,
  excerpt: 'the start of it',
} as const;

describe('job-contracts: notification jobs', () => {
  it.each([
    { schema: NotifySubscribersJob, valid: { kind: 'live', videoId: VIDEO_ID } },
    { schema: NotifyCommentJob, valid: { videoId: VIDEO_ID, commentId: COMMENT_ID } },
    { schema: NotifyHeartJob, valid: { videoId: VIDEO_ID, commentId: COMMENT_ID } },
    { schema: NotifyPartyInviteJob, valid: { inviteId: INVITE_ID } },
    { schema: NotifyTeamInviteJob, valid: { inviteId: INVITE_ID } },
    { schema: NotifyModerationJob, valid: MODERATION },
    { schema: NotifyProcessingJob, valid: { videoId: VIDEO_ID, outcome: 'failed' } },
    { schema: NotifyProcessingJob, valid: { videoId: VIDEO_ID, outcome: 'held' } },
    { schema: AnnounceLiveJob, valid: { liveStreamId: VIDEO_ID, after: AFTER } },
  ])('reads a well-formed payload', ({ schema, valid }) => {
    expect(schema.parse(valid)).toEqual(valid);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('refuses a fan-out for a kind that has no subscribers', () => {
    expect(NotifySubscribersJob.safeParse({ kind: 'reply', videoId: VIDEO_ID }).success).toBe(
      false
    );
  });

  it.each([
    {
      scenario: 'a first batch',
      outbox: subscribersOutbox({ kind: 'upload', videoId: VIDEO_ID }),
      name: NOTIFY_SUBSCRIBERS,
      jobId: `${VIDEO_ID}--notify-subscribers--upload`,
    },
    {
      scenario: 'a later batch',
      outbox: subscribersOutbox({ kind: 'upload', videoId: VIDEO_ID, after: AFTER }),
      name: NOTIFY_SUBSCRIBERS,
      jobId: `${VIDEO_ID}--notify-subscribers--upload--${AFTER}`,
    },
    {
      scenario: 'a later live announcement',
      outbox: announceLiveOutbox({ liveStreamId: VIDEO_ID, after: AFTER }),
      name: ANNOUNCE_LIVE,
      jobId: `${VIDEO_ID}--announce-live--${AFTER}`,
    },
    {
      scenario: 'a later batch of a post',
      outbox: postSubscribersOutbox({ postId: VIDEO_ID, after: AFTER }),
      name: NOTIFY_POST_SUBSCRIBERS,
      jobId: `${VIDEO_ID}--notify-post-subscribers--${AFTER}`,
    },
    {
      scenario: 'a comment',
      outbox: commentOutbox({ videoId: VIDEO_ID, commentId: COMMENT_ID }),
      name: NOTIFY_COMMENT,
      jobId: `${COMMENT_ID}--notify-comment`,
    },
    {
      scenario: 'a heart',
      outbox: heartOutbox({ videoId: VIDEO_ID, commentId: COMMENT_ID }),
      name: NOTIFY_HEART,
      jobId: `${COMMENT_ID}--notify-heart`,
    },
    {
      scenario: 'a party invite',
      outbox: partyInviteOutbox({ inviteId: INVITE_ID }),
      name: NOTIFY_PARTY_INVITE,
      jobId: `${INVITE_ID}--notify-party-invite`,
    },
    {
      scenario: 'a team invite',
      outbox: teamInviteOutbox({ inviteId: INVITE_ID }),
      name: NOTIFY_TEAM_INVITE,
      jobId: `${INVITE_ID}--notify-team-invite`,
    },
    {
      scenario: 'a visible moderation action',
      outbox: moderationOutbox(MODERATION),
      name: NOTIFY_MODERATION,
      jobId: `${EVENT_ID}--notify-moderation`,
    },
    {
      scenario: 'a finished upload',
      outbox: transitionNotificationJobs(VIDEO_ID, 'package', 'private')[0],
      name: NOTIFY_PROCESSING,
      jobId: `${VIDEO_ID}--notify-processing--ready`,
    },
  ])('puts $scenario on the notify queue under a job id of its own', ({ outbox, name, jobId }) => {
    expect(outbox).toMatchObject({
      kind: 'notification',
      payload: {
        type: 'queue',
        queueName: 'notify',
        job: { name, opts: { jobId, ...stagePolicies.notify, ...defaultJobOptions } },
      },
    });
    expect(jobId).not.toContain(':');
  });

  it.each([
    { edge: 'package', visibility: 'public', jobs: ['processing--ready', 'subscribers'] },
    { edge: 'package', visibility: 'unlisted', jobs: ['processing--ready'] },
    { edge: 'package', visibility: 'private', jobs: ['processing--ready'] },
    { edge: 'finalizeLive', visibility: 'public', jobs: ['processing--ready'] },
    { edge: 'fail', visibility: 'public', jobs: ['processing--failed'] },
    { edge: 'failProbe', visibility: 'public', jobs: ['processing--failed'] },
    { edge: 'reconcileFail', visibility: 'public', jobs: ['processing--failed'] },
    { edge: 'failLive', visibility: 'public', jobs: ['processing--failed'] },
    { edge: 'hold', visibility: 'public', jobs: ['processing--held'] },
    { edge: 'approve', visibility: 'public', jobs: ['processing--approved'] },
    { edge: 'rejectScreening', visibility: 'public', jobs: ['processing--rejected'] },
    { edge: 'appeal', visibility: 'public', jobs: ['processing--held'] },
    { edge: 'takedown', visibility: 'public', jobs: ['processing--rejected'] },
    { edge: 'reject', visibility: 'public', jobs: [] },
    { edge: 'completeProbe', visibility: 'public', jobs: [] },
    { edge: 'delete', visibility: 'public', jobs: [] },
  ] as const)(
    'the $edge edge of a $visibility video enqueues $jobs',
    ({ edge, visibility, jobs }) => {
      const enqueued = transitionNotificationJobs(VIDEO_ID, edge, visibility);

      expect(enqueued.map((job) => job.payload.job.opts.jobId)).toEqual(
        jobs.map((job) => expect.stringContaining(`notify-${job}`))
      );
    }
  );

  it.each([
    { status: 'READY', before: 'private', after: 'public', enqueued: true },
    { status: 'READY', before: 'unlisted', after: 'public', enqueued: true },
    { status: 'READY', before: 'public', after: 'public', enqueued: false },
    { status: 'READY', before: 'public', after: 'private', enqueued: false },
    { status: 'PROCESSING', before: 'private', after: 'public', enqueued: false },
  ] as const)(
    'a $status video going $before to $after enqueues a fan-out: $enqueued',
    ({ status, before, after, enqueued }) => {
      expect(visibilityNotificationJobs(VIDEO_ID, status, before, after)).toHaveLength(
        enqueued ? 1 : 0
      );
    }
  );
});
