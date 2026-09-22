import { QueueError, type QueueJob } from '@vp/core/ports';
import { UnrecoverableError } from 'bullmq';
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
      { scenario: 'the client answers PONG', init: {}, expected: true },
      { scenario: 'the client answers otherwise', init: { pingResult: 'NOPE' }, expected: false },
      { scenario: 'there is no connection', init: { failClient: true }, expected: false },
    ])('reports health as $expected when $scenario', async ({ init, expected }) => {
      const subject = new BullMqJobQueue({
        name: 'probe',
        queue: new FakeQueue(init).asQueue(),
      });
      expect(await subject.checkHealth()).toBe(expected);
    });
  });

  describe('add', () => {
    it('forwards the retry policy and returns the enqueued job', async () => {
      const job = await jobQueue.add(
        'probe',
        { videoId: 'v1' },
        {
          jobId: 'v1--probe',
          attempts: 5,
          priority: 2,
          backoff: { type: 'exponential', delay: 1000 },
        }
      );

      expect(job).toMatchObject({ id: 'v1--probe', name: 'probe', data: { videoId: 'v1' } });
      expect(queue.added[0]?.opts).toMatchObject({
        jobId: 'v1--probe',
        attempts: 5,
        priority: 2,
        backoff: { type: 'exponential', delay: 1000 },
      });
    });

    it('wraps an enqueue failure in a QueueError naming the queue', async () => {
      Object.assign(queue, {
        add: async () => {
          throw new Error('redis unavailable');
        },
      });

      await expect(jobQueue.add('probe', {})).rejects.toThrow(QueueError);
      await expect(jobQueue.add('probe', {})).rejects.toThrow(/queue "probe"/);
    });
  });

  describe('job state', () => {
    it('reads the state of a known job and undefined for an unknown one', async () => {
      const subject = new BullMqJobQueue({
        name: 'probe',
        queue: new FakeQueue({ jobs: [fakeJob({ id: 'job-1', state: 'active' })] }).asQueue(),
      });

      expect(await subject.getJobState('job-1')).toBe('active');
      expect(await subject.getJobState('missing')).toBeUndefined();
    });

    it('projects the job list onto the port shape', async () => {
      const subject = new BullMqJobQueue({
        name: 'probe',
        queue: new FakeQueue({
          jobs: [fakeJob({ id: 'job-1', name: 'probe', attemptsMade: 2 })],
        }).asQueue(),
      });

      expect(await subject.getJobs()).toEqual([
        { id: 'job-1', name: 'probe', data: {}, attemptsMade: 2 },
      ]);
    });

    it('fills in the counts the queue does not report', async () => {
      const subject = new BullMqJobQueue({
        name: 'probe',
        queue: new FakeQueue({ counts: { waiting: 3, failed: 1 } }).asQueue(),
      });

      expect(await subject.getJobCounts()).toEqual({
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
      expect(await jobQueue.isPaused()).toBe(false);

      await jobQueue.pause();
      expect(await jobQueue.isPaused()).toBe(true);

      await jobQueue.resume();
      expect(await jobQueue.isPaused()).toBe(false);
    });
  });

  describe('schedulers', () => {
    it('passes the repeat options and template through', async () => {
      const result = await jobQueue.upsertJobScheduler(
        'reconcile',
        { every: 60_000 },
        { name: 'reconcile', data: { scope: 'all' }, opts: { attempts: 1 } }
      );

      expect(result).toMatchObject({
        id: 'reconcile',
        repeat: { every: 60_000 },
        template: { name: 'reconcile' },
      });
    });

    it('projects the registered schedulers, falling back across the naming fields', async () => {
      const subject = new BullMqJobQueue({
        name: 'probe',
        queue: new FakeQueue({
          schedulers: [
            { id: 'a', name: 'reconcile', pattern: '* * * * *', template: { data: { x: 1 } } },
            { key: 'k', every: 1000 },
          ],
        }).asQueue(),
      });

      expect(await subject.getJobSchedulers()).toEqual([
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

    const rejection = (promise: Promise<unknown>): Promise<Error> =>
      promise.then(
        () => {
          throw new Error('expected the handler to reject');
        },
        (err: Error) => err
      );

    it('marks a permanent failure unrecoverable so bullmq stops retrying', async () => {
      const cause = Object.assign(new Error('bad codec'), {
        isRetryable: false,
        code: 'UNSUPPORTED_CODEC',
      });
      const handler = await handlerFor(async () => {
        throw cause;
      });

      const error = await rejection(handler(fakeJob()));
      expect(error).toBeInstanceOf(UnrecoverableError);
      expect(error).toMatchObject({ message: 'bad codec', code: 'UNSUPPORTED_CODEC', cause });
    });

    it('lets a transient failure through so bullmq retries it', async () => {
      const handler = await handlerFor(async () => {
        throw Object.assign(new Error('s3 timeout'), { isRetryable: true });
      });

      const error = await rejection(handler(fakeJob({ attemptsMade: 9 })));
      expect(error).not.toBeInstanceOf(UnrecoverableError);
      expect(error.message).toBe('s3 timeout');
    });

    it('retries an unclassified failure, then gives up on the third attempt', async () => {
      const handler = await handlerFor(async () => {
        throw new Error('who knows');
      });

      expect(await rejection(handler(fakeJob({ attemptsMade: 1 })))).not.toBeInstanceOf(
        UnrecoverableError
      );
      expect(await rejection(handler(fakeJob({ attemptsMade: 2 })))).toBeInstanceOf(
        UnrecoverableError
      );
    });

    it('wraps a worker start-up failure in a QueueError', async () => {
      Object.defineProperty(queue, 'opts', {
        get() {
          throw new Error('queue disposed');
        },
      });

      await expect(jobQueue.process(async () => 'ok')).rejects.toThrow(QueueError);
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

    it('wraps a close failure in a QueueError', async () => {
      Object.assign(queue, {
        close: async () => {
          throw new Error('still draining');
        },
      });

      await expect(jobQueue.close()).rejects.toThrow(QueueError);
    });
  });
});
