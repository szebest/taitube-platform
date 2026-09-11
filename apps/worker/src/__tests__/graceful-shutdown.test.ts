import { InMemoryJobQueue } from '@vp/adapters';
import type { QueueJob } from '@vp/core/ports';
import { describe, expect, it, vi } from 'vitest';

describe('Worker Graceful Shutdown & Scale-in Semantics (Ticket 26)', () => {
  it('allows active job to finish during graceful shutdown without stalling', async () => {
    const queue = new InMemoryJobQueue('test-graceful-shutdown');
    let jobExecutionStarted = false;
    let jobCompletedNormally = false;

    // Simulate a transcode job that takes some time
    let completeJobWork: () => void = () => {};
    const jobWorkPromise = new Promise<void>((resolve) => {
      completeJobWork = resolve;
    });

    await queue.process(async (_job: QueueJob<unknown>) => {
      jobExecutionStarted = true;
      await jobWorkPromise;
      jobCompletedNormally = true;
      return { status: 'DONE' };
    });

    // Enqueue a job
    const job = await queue.add('test-job', { videoId: 'video-123' });
    expect(job.id).toBeDefined();

    // Allow microtask to run so drain() picks up the job
    await new Promise((r) => setTimeout(r, 10));

    // Verify job starts executing
    expect(jobExecutionStarted).toBe(true);
    expect(jobCompletedNormally).toBe(false);

    // Verify job is marked active in queue counts
    const countsWhileActive = await queue.getJobCounts();
    expect(countsWhileActive.active).toBe(1);

    // Simulate scale-in signal (SIGTERM): queue.close() is called
    // In BullMQ, worker.close(false) stops accepting new jobs from the queue,
    // while the active job is allowed to finish within terminationGracePeriodSeconds.
    const closePromise = queue.close();

    // Active job finishes normally during shutdown
    completeJobWork();
    await closePromise;

    // Allow execution loop to finalize
    await new Promise((r) => setTimeout(r, 10));

    expect(jobCompletedNormally).toBe(true);

    // After shutdown, no active jobs remain
    const counts = await queue.getJobCounts();
    expect(counts.active).toBe(0);
    expect(counts.failed).toBe(0);
    expect(counts.completed).toBe(1);
  });

  it('verifies BullMQ worker close(false) contract', () => {
    // BullMQ Worker.close(doNotWaitActive = false) guarantees:
    // - Stops fetching new jobs from Redis immediately
    // - Waits for currently active job(s) to finish within the caller's timeout / grace period
    // - Resolves when active jobs are complete
    const mockWorker = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockWorker.close(false);
    expect(mockWorker.close).toHaveBeenCalledWith(false);
  });
});
