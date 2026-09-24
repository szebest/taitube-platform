import { JOB_PRIORITY } from '@vp/domain';
import { PermanentError, TransientError } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { inMemoryJobQueueSubject } from '../../__tests__/contract/in-memory-queue-subjects';
import { describeJobQueueContract } from '../../__tests__/contract/job-queue.contract';
import { InMemoryJobQueue } from '../in-memory-job-queue';

describeJobQueueContract(inMemoryJobQueueSubject);

describe('InMemoryJobQueue', () => {
  it('runs a paid job ahead of the free jobs already waiting', async () => {
    const queue = new InMemoryJobQueue('probe');
    const order: string[] = [];
    expectOk(await queue.add('probe', {}, { jobId: 'free', priority: JOB_PRIORITY.free }));
    expectOk(await queue.add('probe', {}, { jobId: 'paid', priority: JOB_PRIORITY.paid }));

    expectOk(
      await queue.process(async (job) => {
        order.push(job.id);
      })
    );

    expect(order).toEqual(['paid', 'free']);
  });

  it.each([
    {
      scenario: 'retries a transient failure up to its attempts',
      error: new TransientError('X', 'blip'),
      runs: 3,
    },
    {
      scenario: 'fails a permanent failure on its first run',
      error: new PermanentError('X', 'corrupt'),
      runs: 1,
    },
  ])('$scenario', async ({ error, runs }) => {
    const queue = new InMemoryJobQueue('probe');
    const failed = Promise.withResolvers<string>();
    queue.onFailed((job) => failed.resolve(job.id));
    let attempts = 0;
    expectOk(
      await queue.process(async () => {
        attempts += 1;
        throw error;
      })
    );

    expectOk(await queue.add('probe', {}, { jobId: 'job-a', attempts: 3 }));

    expect(await failed.promise).toBe('job-a');
    expect(attempts).toBe(runs);
    expect(expectOk(await queue.getJobState('job-a'))).toBe('failed');
  });

  it('reports a stall to the handler BullMQ would call', () => {
    const queue = new InMemoryJobQueue('probe');
    const stalled: string[] = [];
    queue.onStalled((jobId) => stalled.push(jobId));

    queue.stall('job-a');

    expect(stalled).toEqual(['job-a']);
  });

  it('forgets every job on clear', async () => {
    const queue = new InMemoryJobQueue('probe');
    expectOk(await queue.add('probe', {}, { jobId: 'job-a' }));

    queue.clear();

    expect(expectOk(await queue.getJobState('job-a'))).toBeUndefined();
    expect(expectOk(await queue.getJobs(['waiting']))).toEqual([]);
  });
});
