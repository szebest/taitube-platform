import { ANNOUNCE_COMMENT_HELD, AnnounceCommentHeldJob, commentHeldOutbox } from '../comment-held';
import { defaultJobOptions, stagePolicies } from '../policies';

const HOLD_ID = '00000000-0000-7000-8000-0000000000f1';
const COMMENT_ID = '00000000-0000-7000-8000-0000000000f2';
const VIDEO_ID = '00000000-0000-7000-8000-0000000000f3';
const JOB = { holdId: HOLD_ID, commentId: COMMENT_ID, videoId: VIDEO_ID, recipients: [HOLD_ID] };

describe('job-contracts: comment held', () => {
  it.each([
    { scenario: 'a hold with a recipient', payload: JOB, ok: true },
    { scenario: 'no recipient', payload: { ...JOB, recipients: [] }, ok: false },
    { scenario: 'no hold id', payload: { ...JOB, holdId: undefined }, ok: false },
  ])('reads a job with $scenario: $ok', ({ payload, ok }) => {
    expect(AnnounceCommentHeldJob.safeParse(payload).success).toBe(ok);
  });

  it('queues one announcement per hold on the notify queue', () => {
    expect(commentHeldOutbox(JOB).payload).toEqual({
      type: 'queue',
      queueName: 'notify',
      job: {
        name: ANNOUNCE_COMMENT_HELD,
        data: JOB,
        opts: {
          jobId: `${HOLD_ID}--${ANNOUNCE_COMMENT_HELD}`,
          ...stagePolicies.notify,
          ...defaultJobOptions,
        },
      },
    });
  });
});
