import { LiveJob, liveOutbox } from '../live';
import { stagePolicies } from '../policies';

const job = {
  liveStreamId: '11111111-1111-7111-8111-111111111111',
  videoId: '22222222-2222-7222-8222-222222222222',
};

describe('@vp/job-contracts: live', () => {
  it('validates a live job', () => {
    expect(LiveJob.safeParse(job).success).toBe(true);
  });

  it('enqueues one job per broadcast on the live queue, under its policy', () => {
    const { payload } = liveOutbox(job);

    expect(payload).toMatchObject({
      type: 'queue',
      queueName: 'live',
      job: {
        name: 'live',
        data: job,
        opts: { jobId: `${job.liveStreamId}--live`, attempts: stagePolicies.live.attempts },
      },
    });
  });
});
