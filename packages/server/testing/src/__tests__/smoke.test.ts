import { FIXTURES, createMockJob, withEnv } from '../index';

describe('@vp/testing smoke test', () => {
  it('names the seeded video and dev user by what they are', () => {
    expect(FIXTURES.VIDEO_ID).toBe('018f0000-0000-7000-8000-000000000001');
    expect(FIXTURES.DEV_USER_ID).toBe('00000000-0000-7000-8000-000000000001');
    expect(FIXTURES.TRACEPARENT).toContain('00-4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('creates mock job with default methods', async () => {
    const job = createMockJob('probe', { videoId: FIXTURES.VIDEO_ID });
    expect(job.name).toBe('probe');
    expect(job.data.videoId).toBe(FIXTURES.VIDEO_ID);
    expect(job.attemptsMade).toBe(0);
    await expect(job.updateProgress(50)).resolves.toBeUndefined();
  });

  it('safely scopes environment overrides with withEnv', async () => {
    await withEnv({ TEST_VAR: 'original' }, async () => {
      await withEnv({ TEST_VAR: 'overridden' }, () => {
        expect(process.env.TEST_VAR).toBe('overridden');
      });
      expect(process.env.TEST_VAR).toBe('original');
    });
    expect(process.env.TEST_VAR).toBeUndefined();
  });
});
