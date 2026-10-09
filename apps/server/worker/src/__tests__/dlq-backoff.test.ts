import { stagePolicies } from '@vp/job-contracts';

describe('apps/worker: transcode retry backoff', () => {
  it('backs off exponentially from 10 s with 50% jitter across four attempts', () => {
    const policy = stagePolicies['transcode-720p'];

    expect(policy.attempts).toBe(4);
    expect(policy.backoff).toMatchObject({ type: 'exponential', delay: 10_000, jitter: 0.5 });
  });
});
