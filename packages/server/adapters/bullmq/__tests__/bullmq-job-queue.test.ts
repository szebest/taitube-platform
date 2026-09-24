import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { isOk } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { BullMqJobQueue } from '../bullmq-job-queue';
import { FakeQueue, fakeJob } from './fake-queue';
import { type WorkerHandler, fakeWorkerFactory, workers } from './fake-worker';

describe('BullMqJobQueue', () => {
  let queue: FakeQueue;
  let jobQueue: BullMqJobQueue;

  beforeEach(() => {
    workers.length = 0;
    queue = new FakeQueue();
    jobQueue = new BullMqJobQueue({
      type: 'queue',
      name: 'probe',
      queue: queue.asQueue(),
      createWorker: fakeWorkerFactory,
    });
  });

  describe('identity and health', () => {
    it('exposes the underlying queue', () => {
      expect(jobQueue.getName()).toBe('probe');
      expect(jobQueue.getRawQueue()).toBe(queue.asQueue());
    });

    it.each([
      { scenario: 'the client is ready', init: {}, expected: true },
      { scenario: 'the client is reconnecting', init: { status: 'reconnecting' }, expected: false },
      { scenario: 'there is no connection', init: { failClient: true }, expected: false },
    ])('reports health as $expected when $scenario', async ({ init, expected }) => {
      const subject = new BullMqJobQueue({
        type: 'queue',
        name: 'probe',
        queue: new FakeQueue(init).asQueue(),
      });
      expect(isOk(await subject.checkHealth())).toBe(expected);
    });
  });

  describe('add', () => {
    it('forwards the retry policy and returns the enqueued job', async () => {
      const job = expectOk(
        await jobQueue.add(
          'probe',
          { videoId: 'v1' },
          {
            jobId: 'v1--probe',
            attempts: 5,
            priority: 2,
            backoff: { type: 'exponential', delay: 1000 },
          }
        )
      );

      expect(job).toMatchObject({ id: 'v1--probe', name: 'probe', data: { videoId: 'v1' } });
      expect(queue.added[0]?.opts).toMatchObject({
        jobId: 'v1--probe',
        attempts: 5,
        priority: 2,
        backoff: { type: 'exponential', delay: 1000 },
      });
    });

    it('reports an enqueue failure as QUEUE_UNAVAILABLE naming the operation', async () => {
      Object.assign(queue, {
        add: async () => {
          throw new Error('redis unavailable');
        },
      });

      expect(expectErr(await jobQueue.add('probe', {}))).toMatchObject({
        code: ErrorCodes.QUEUE_UNAVAILABLE,
        operation: 'add',
      });
    });
  });

  describe('job state', () => {
    it('reads the state of a known job and undefined for an unknown one', async () => {
      const subject = new BullMqJobQueue({
        type: 'queue',
        name: 'probe',
        queue: new FakeQueue({ jobs: [fakeJob({ id: 'job-1', state: 'active' })] }).asQueue(),
      });

      expect(expectOk(await subject.getJobState('job-1'))).toBe('active');
      expect(expectOk(await subject.getJobState('missing'))).toBeUndefined();
    });

    it('projects the job list onto the port shape', async () => {
      const subject = new BullMqJobQueue({
        type: 'queue',
        name: 'probe',
        queue: new FakeQueue({
          jobs: [fakeJob({ id: 'job-1', name: 'probe', attemptsMade: 2 })],
        }).asQueue(),
      });

      expect(expectOk(await subject.getJobs())).toEqual([
        {
          id: 'job-1',
          name: 'probe',
          data: {},
          attemptsMade: 2,
          opts: { jobId: 'job-1', attempts: 3, priority: 5 },
        },
      ]);
    });

    it('fills in the counts the queue does not report', async () => {
      const subject = new BullMqJobQueue({
        type: 'queue',
        name: 'probe',
        queue: new FakeQueue({ counts: { waiting: 3, failed: 1 } }).asQueue(),
      });

      expect(expectOk(await subject.getJobCounts())).toEqual({
        waiting: 3,
        active: 0,
        completed: 0,
        failed: 1,
        delayed: 0,
        paused: 0,
      });
    });
  });

  describe('pause and resume', () => {
    it('toggles the paused state', async () => {
      expect(expectOk(await jobQueue.isPaused())).toBe(false);

      await jobQueue.pause();
      expect(expectOk(await jobQueue.isPaused())).toBe(true);

      await jobQueue.resume();
      expect(expectOk(await jobQueue.isPaused())).toBe(false);
    });
  });

  describe('schedulers', () => {
    it('passes the repeat options and template through', async () => {
      const result = expectOk(
        await jobQueue.upsertJobScheduler(
          'reconcile',
          { every: 60_000 },
          { name: 'reconcile', data: { scope: 'all' }, opts: { attempts: 1 } }
        )
      );

      expect(result).toMatchObject({
        id: 'reconcile',
        repeat: { every: 60_000 },
        template: { name: 'reconcile' },
      });
    });

    it('projects the registered schedulers, falling back across the naming fields', async () => {
      const subject = new BullMqJobQueue({
        type: 'queue',
        name: 'probe',
        queue: new FakeQueue({
          schedulers: [
            { id: 'a', name: 'reconcile', pattern: '* * * * *', template: { data: { x: 1 } } },
            { key: 'k', every: 1000 },
          ],
        }).asQueue(),
      });

      expect(expectOk(await subject.getJobSchedulers())).toEqual([
        { id: 'a', name: 'reconcile', pattern: '* * * * *', every: undefined, data: { x: 1 } },
        { id: 'k', name: '', pattern: undefined, every: 1000, data: undefined },
      ]);
    });
  });

  describe('process', () => {
    async function handlerFor(
      onJob: (job: QueueJob<unknown>) => Promise<unknown>
    ): Promise<WorkerHandler> {
      await jobQueue.process(onJob, { concurrency: 4, lockDurationMs: 30_000 });
      return workers[0]?.handler as WorkerHandler;
    }

    it('wires the worker to the queue name, prefix and connection', async () => {
      await jobQueue.process(async () => 'ok', { concurrency: 4, lockDurationMs: 30_000 });

      expect(workers[0]?.queueName).toBe('probe');
      expect(workers[0]?.options).toMatchObject({
        prefix: 'bull',
        concurrency: 4,
        lockDuration: 30_000,
        connection: { host: 'fake', port: 6379 },
      });
    });

    it('hands the handler a job it can report progress and children through', async () => {
      let received: QueueJob<unknown> | undefined;
      const handler = await handlerFor(async (job) => {
        received = job;
        await job.updateProgress?.(50);
        return job.getChildrenValues?.();
      });

      const job = fakeJob({ id: 'v1--probe', childrenValues: { 'child-1': { ok: true } } });
      expect(await handler(job)).toEqual({ 'child-1': { ok: true } });
      expect(received).toMatchObject({ id: 'v1--probe', name: 'probe', attemptsMade: 0 });
      expect((job as unknown as { progress: number[] }).progress).toEqual([50]);
    });

    it('reports no children as an empty record', async () => {
      const handler = await handlerFor(async (job) => job.getChildrenValues?.());
      expect(await handler(fakeJob({ childrenValues: undefined }))).toEqual({});
    });

    it('reports a worker start-up failure as QUEUE_UNAVAILABLE', async () => {
      Object.defineProperty(queue, 'opts', {
        get() {
          throw new Error('queue disposed');
        },
      });

      expect(expectErr(await jobQueue.process(async () => 'ok')).code).toBe(
        ErrorCodes.QUEUE_UNAVAILABLE
      );
    });
  });

  describe('failure handler', () => {
    it('receives the failures of a worker started afterwards', async () => {
      const seen: Array<{ id: string; message: string }> = [];
      jobQueue.onFailed((job, err) => {
        seen.push({ id: job.id, message: err.message });
      });
      await jobQueue.process(async () => 'ok');

      workers[0]?.emitFailed(fakeJob({ id: 'job-1' }), new Error('failed'));
      expect(seen).toEqual([{ id: 'job-1', message: 'failed' }]);
    });

    it('attaches to a worker that is already running', async () => {
      const seen: string[] = [];
      await jobQueue.process(async () => 'ok');
      jobQueue.onFailed((job) => {
        seen.push(job.id);
      });

      workers[0]?.emitFailed(fakeJob({ id: 'job-2' }), new Error('failed'));
      expect(seen).toEqual(['job-2']);
    });

    it('ignores a failure event that carries no job', async () => {
      const seen: string[] = [];
      jobQueue.onFailed((job) => {
        seen.push(job.id);
      });
      await jobQueue.process(async () => 'ok');

      workers[0]?.emitFailed(undefined, new Error('orphan'));
      expect(seen).toEqual([]);
    });
  });

  describe('stalled handler', () => {
    it.each([
      { scenario: 'set before the worker starts', setFirst: true },
      { scenario: 'set on a worker that is already running', setFirst: false },
    ])('hears a stalled job when $scenario', async ({ setFirst }) => {
      const stalled: string[] = [];
      if (setFirst) jobQueue.onStalled((jobId) => stalled.push(jobId));
      await jobQueue.process(async () => 'ok');
      if (!setFirst) jobQueue.onStalled((jobId) => stalled.push(jobId));

      workers[0]?.emitStalled('job-3');

      expect(stalled).toEqual(['job-3']);
    });
  });

  describe('close', () => {
    it('drains the worker before closing the queue', async () => {
      await jobQueue.process(async () => 'ok');
      await jobQueue.close();

      expect(workers[0]?.closedWaiting).toBe(false);
      expect(queue.closed).toBe(true);
    });

    it('closes a queue that never started a worker', async () => {
      await jobQueue.close();
      expect(queue.closed).toBe(true);
    });

    it('reports a close failure as QUEUE_UNAVAILABLE', async () => {
      Object.assign(queue, {
        close: async () => {
          throw new Error('still draining');
        },
      });

      expect(expectErr(await jobQueue.close()).code).toBe(ErrorCodes.QUEUE_UNAVAILABLE);
    });
  });
});
