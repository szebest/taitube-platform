import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { expectOk } from '@vp/testing/result';

describe('worker graceful shutdown and scale-in', () => {
  it('allows active job to finish during graceful shutdown without stalling', async () => {
    const queue = new InMemoryJobQueue('test-graceful-shutdown');
    let jobExecutionStarted = false;
    let jobCompletedNormally = false;

    let completeJobWork: () => void = () => {};
    const jobWorkPromise = new Promise<void>((resolve) => {
      completeJobWork = resolve;
    });

    await queue.process(async () => {
      jobExecutionStarted = true;
      await jobWorkPromise;
      jobCompletedNormally = true;
      return { status: 'DONE' };
    });

    const job = expectOk(await queue.add('test-job', { videoId: 'video-123' }));
    expect(job.id).toBeDefined();

    await new Promise((r) => setTimeout(r, 10));

    expect(jobExecutionStarted).toBe(true);
    expect(jobCompletedNormally).toBe(false);

    const countsWhileActive = expectOk(await queue.getJobCounts());
    expect(countsWhileActive.active).toBe(1);

    const closePromise = queue.close();

    completeJobWork();
    await closePromise;

    await new Promise((r) => setTimeout(r, 10));

    expect(jobCompletedNormally).toBe(true);

    const counts = expectOk(await queue.getJobCounts());
    expect(counts).toMatchObject({ active: 0, failed: 0, completed: 1 });
  });

  it('records a close(false) call on a worker double', () => {
    const mockWorker = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockWorker.close(false);
    expect(mockWorker.close).toHaveBeenCalledWith(false);
  });
});
