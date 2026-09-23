import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { UnrecoverableError } from 'bullmq';
import { bullMqProcessor } from '../bullmq-processor';
import { fakeJob } from './fake-queue';

const rejection = (promise: Promise<unknown>): Promise<Error> =>
  promise.then(
    () => {
      throw new Error('expected the processor to reject');
    },
    (err: Error) => err
  );

describe('bullmq adapter: the ADR-18 queue boundary', () => {
  it('hands the handler a job it can report progress and children through', async () => {
    let received: QueueJob<unknown> | undefined;
    const processor = bullMqProcessor(async (job) => {
      received = job;
      await job.updateProgress?.(50);
      return job.getChildrenValues?.();
    });

    const job = fakeJob({ id: 'v1--probe', childrenValues: { 'child-1': { ok: true } } });

    expect(await processor(job)).toEqual({ 'child-1': { ok: true } });
    expect(received).toMatchObject({ id: 'v1--probe', name: 'probe', attemptsMade: 0 });
    expect((job as unknown as { progress: number[] }).progress).toEqual([50]);
  });

  it('reports no children as an empty record', async () => {
    const processor = bullMqProcessor(async (job) => job.getChildrenValues?.());

    expect(await processor(fakeJob({ childrenValues: undefined }))).toEqual({});
  });

  it('reads the state through to the handler', async () => {
    const processor = bullMqProcessor(async (job) => job.getState?.());

    expect(await processor(fakeJob({ state: 'active' }))).toBe('active');
  });

  it('marks a permanent failure unrecoverable so bullmq stops retrying', async () => {
    const cause = new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'bad codec');
    const processor = bullMqProcessor(async () => {
      throw cause;
    });

    const error = await rejection(processor(fakeJob()));

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error).toMatchObject({ message: 'bad codec', code: 'UNSUPPORTED_CODEC', cause });
  });

  it('lets a transient failure through so bullmq retries it', async () => {
    const processor = bullMqProcessor(async () => {
      throw new TransientError(ErrorCodes.STORAGE_UNAVAILABLE, 's3 timeout');
    });

    const error = await rejection(processor(fakeJob({ attemptsMade: 9 })));

    expect(error).not.toBeInstanceOf(UnrecoverableError);
    expect(error.message).toBe('s3 timeout');
  });

  it('passes a foreign UnrecoverableError straight through', async () => {
    const cause = new UnrecoverableError('already final');
    const processor = bullMqProcessor(async () => {
      throw cause;
    });

    expect(await rejection(processor(fakeJob()))).toBe(cause);
  });

  it.each([
    { attemptsMade: 1, unrecoverable: false },
    { attemptsMade: 2, unrecoverable: true },
  ])(
    'retries an unclassified failure, then gives up on attempt $attemptsMade',
    async ({ attemptsMade, unrecoverable }) => {
      const processor = bullMqProcessor(async () => {
        throw new Error('who knows');
      });

      const error = await rejection(processor(fakeJob({ attemptsMade })));

      expect(error instanceof UnrecoverableError).toBe(unrecoverable);
    }
  );
});
