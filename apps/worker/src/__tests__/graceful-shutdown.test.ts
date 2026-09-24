import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { expectOk } from '@vp/testing/result';

describe('worker graceful shutdown and scale-in', () => {
  it('allows active job to finish during graceful shutdown without stalling', async () => {
    const queue = new InMemoryJobQueue('test-graceful-shutdown');
    const { promise: started, resolve: markStarted } = Promise.withResolvers<void>();
    const { promise: finishWork, resolve: completeJobWork } = Promise.withResolvers<void>();
    const { promise: completed, resolve: markCompleted } = Promise.withResolvers<void>();
    queue.onJobCompleted(() => markCompleted());

    await queue.process(async () => {
      markStarted();
      await finishWork;
      return { status: 'DONE' };
    });
    expectOk(await queue.add('test-job', { videoId: 'video-123' }));
    await started;

    expect(expectOk(await queue.getJobCounts()).active).toBe(1);

    const closed = queue.close();
    completeJobWork();
    await closed;
    await completed;

    expect(expectOk(await queue.getJobCounts())).toMatchObject({
      active: 0,
      failed: 0,
      completed: 1,
    });
  });
});
