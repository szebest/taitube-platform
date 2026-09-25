import { randomUUID } from 'node:crypto';
import type { JobQueue, QueueJob } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface JobQueueSubject {
  readonly queue: JobQueue;
  close(): Promise<void>;
}

export type MakeJobQueueSubject = (name: string) => Promise<JobQueueSubject>;

export function describeJobQueueContract(makeSubject: MakeJobQueueSubject): void {
  describe('JobQueue contract', () => {
    let subject: JobQueueSubject;
    let queue: JobQueue;
    let name: string;

    beforeEach(async () => {
      name = `contract-${randomUUID()}`;
      subject = await makeSubject(name);
      queue = subject.queue;
    });

    afterEach(async () => {
      await subject.close();
    });

    it('answers a health check under the name it was opened with', async () => {
      expectOk(await queue.checkHealth());
      expect(queue.getName()).toBe(name);
    });

    it('adds a job that waits under the id it was given', async () => {
      const job = expectOk(await queue.add('probe', { videoId: 'v1' }, { jobId: 'job-a' }));

      expect(job).toMatchObject({ id: 'job-a', name: 'probe', data: { videoId: 'v1' } });
      expect(expectOk(await queue.getJobState('job-a'))).toBe('waiting');
    });

    it('answers ok(undefined) for the state of a job it never saw', async () => {
      expect(expectOk(await queue.getJobState('job-absent'))).toBeUndefined();
    });

    it('keeps the first job for a repeated id', async () => {
      expectOk(await queue.add('probe', { attempt: 1 }, { jobId: 'job-a' }));

      expectOk(await queue.add('probe', { attempt: 2 }, { jobId: 'job-a' }));

      const waiting = expectOk(await queue.getJobs(['waiting']));
      expect(waiting.map((job) => job.data)).toEqual([{ attempt: 1 }]);
      expect(expectOk(await queue.getJobCounts()).waiting).toBe(1);
    });

    it('lists the waiting jobs', async () => {
      expectOk(await queue.add('probe', {}, { jobId: 'job-a' }));
      expectOk(await queue.add('probe', {}, { jobId: 'job-b' }));

      const waiting = expectOk(await queue.getJobs(['waiting']));

      expect(waiting.map((job) => job.id).sort()).toEqual(['job-a', 'job-b']);
    });

    it('reports a pause and a resume', async () => {
      expectOk(await queue.pause());
      expect(expectOk(await queue.isPaused())).toBe(true);

      expectOk(await queue.resume());
      expect(expectOk(await queue.isPaused())).toBe(false);
    });

    it('hands an added job to the handler that processes the queue', async () => {
      const handled = Promise.withResolvers<QueueJob<unknown>>();
      expectOk(await queue.add('probe', { videoId: 'v1' }, { jobId: 'job-a' }));

      expectOk(
        await queue.process(async (job) => {
          handled.resolve(job);
          return 'done';
        })
      );

      expect(await handled.promise).toMatchObject({ id: 'job-a', data: { videoId: 'v1' } });
    });

    it('lists a scheduler it upserted', async () => {
      expectOk(
        await queue.upsertJobScheduler('nightly', { every: 60_000 }, { name: 'sweep', data: {} })
      );

      const schedulers = expectOk(await queue.getJobSchedulers());

      expect(schedulers).toEqual([expect.objectContaining({ id: 'nightly', every: 60_000 })]);
    });
  });
}
