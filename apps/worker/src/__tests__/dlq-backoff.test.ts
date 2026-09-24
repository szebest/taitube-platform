import { calculateBackoffDelay, stagePolicies } from '@vp/job-contracts';

describe('apps/worker: transcode retry backoff', () => {
  it('backs off exponentially from 10 s with 50% jitter across the retries', () => {
    const policy = stagePolicies['transcode-720p'];
    expect(policy.attempts).toBe(4);
    expect(policy.backoff).toMatchObject({ type: 'exponential', delay: 10_000, jitter: 0.5 });

    for (const [attempt, expectedMax] of [
      [1, 10_000],
      [2, 20_000],
      [3, 40_000],
    ] as const) {
      const { minDelay, maxDelay, delay } = calculateBackoffDelay(policy.backoff, attempt);
      expect(maxDelay).toBe(expectedMax);
      expect(minDelay).toBe(expectedMax / 2);
      expect(delay).toBeGreaterThanOrEqual(minDelay);
      expect(delay).toBeLessThanOrEqual(maxDelay);
    }
  });
});
