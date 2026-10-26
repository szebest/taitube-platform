import { defaultJobOptions, stagePolicies } from '../policies';
import {
  NOTIFY_COMMENT,
  NOTIFY_PROCESSING,
  NOTIFY_SUBSCRIBERS,
  NotifyCommentJob,
  NotifyProcessingJob,
  NotifySubscribersJob,
  commentOutbox,
  notificationJobIds,
  processingOutbox,
  subscribersOutbox,
  transitionNotificationJobs,
  visibilityNotificationJobs,
} from '../notifications';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000a1';
const COMMENT_ID = '00000000-0000-7000-8000-0000000000b1';
const AFTER = '00000000-0000-7000-8000-0000000000c1';

describe('job-contracts: notification jobs', () => {
  it.each([
    { schema: NotifySubscribersJob, valid: { kind: 'live', videoId: VIDEO_ID } },
    { schema: NotifyCommentJob, valid: { videoId: VIDEO_ID, commentId: COMMENT_ID } },
    { schema: NotifyProcessingJob, valid: { videoId: VIDEO_ID, outcome: 'failed' } },
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
      scenario: 'a comment',
      outbox: commentOutbox({ videoId: VIDEO_ID, commentId: COMMENT_ID }),
      name: NOTIFY_COMMENT,
      jobId: `${COMMENT_ID}--notify-comment`,
    },
    {
      scenario: 'a finished upload',
      outbox: processingOutbox({ videoId: VIDEO_ID, outcome: 'ready' }),
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

  it('names a fan-out batch after the subscriber it follows', () => {
    expect(notificationJobIds.subscribers(VIDEO_ID, 'live')).not.toBe(
      notificationJobIds.subscribers(VIDEO_ID, 'upload')
    );
  });

  it.each([
    { to: 'READY', visibility: 'public', names: [NOTIFY_PROCESSING, NOTIFY_SUBSCRIBERS] },
    { to: 'READY', visibility: 'unlisted', names: [NOTIFY_PROCESSING] },
    { to: 'READY', visibility: 'private', names: [NOTIFY_PROCESSING] },
    { to: 'FAILED', visibility: 'public', names: [NOTIFY_PROCESSING] },
    { to: 'PROCESSING', visibility: 'public', names: [] },
    { to: 'DELETED', visibility: 'public', names: [] },
  ] as const)(
    'a video that goes $to while $visibility enqueues $names',
    ({ to, visibility, names }) => {
      const jobs = transitionNotificationJobs(VIDEO_ID, to, visibility);

      expect(jobs.map((job) => job.payload.job.name)).toEqual(names);
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
