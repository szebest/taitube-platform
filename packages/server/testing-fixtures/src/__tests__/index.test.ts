import { createMockJob } from '../index';

describe('@vp/testing-fixtures', () => {
  it('builds a first-attempt job that reports progress', async () => {
    const job = createMockJob('probe', { videoId: 'v1' });

    expect(job).toMatchObject({ name: 'probe', data: { videoId: 'v1' }, attemptsMade: 0 });
    await expect(job.updateProgress(50)).resolves.toBeUndefined();
  });
});
