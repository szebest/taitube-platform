import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import type { JobSchedulerTemplate, UpsertJobSchedulerOptions } from '@vp/core/ports';
import { ErrorCodes, type QueueUnavailable, queueUnavailable } from '@vp/errors';
import { type Result, err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { registerHousekeepingSchedulers } from '../housekeeping-schedulers';

class UnreachableQueue extends InMemoryJobQueue {
  override async upsertJobScheduler<T = unknown>(
    _id: string,
    _repeatOpts: UpsertJobSchedulerOptions,
    _template?: JobSchedulerTemplate<T>
  ): Promise<Result<unknown, QueueUnavailable>> {
    return err(queueUnavailable('upsertJobScheduler'));
  }
}

const SETTINGS = { flushIntervalMs: 10_000 };

describe('apps/api/services: housekeeping schedulers', () => {
  it('registers every configured scheduler with its cron pattern', async () => {
    const queue = new InMemoryJobQueue('housekeeping');

    expectOk(await registerHousekeepingSchedulers(queue, SETTINGS));

    const registered = expectOk(await queue.getJobSchedulers());
    expect(registered.map((scheduler) => scheduler.id).sort()).toEqual([
      'expire-raw',
      'flush-video-views',
      'purge-deleted',
      'reconcile-processing',
      'reconcile-reaction-counters',
      'reconcile-uploads',
      'tmp-sweep',
    ]);
    expect(registered.find((scheduler) => scheduler.id === 'purge-deleted')?.pattern).toBe(
      '0 * * * *'
    );
  });

  it('repeats the view flush on its interval rather than a cron minute', async () => {
    const queue = new InMemoryJobQueue('housekeeping');

    expectOk(await registerHousekeepingSchedulers(queue, SETTINGS));

    const flush = expectOk(await queue.getJobSchedulers()).find(
      (scheduler) => scheduler.id === 'flush-video-views'
    );
    expect(flush).toMatchObject({ every: 10_000, data: { task: 'flush-video-views' } });
  });

  it('takes an override for a scheduler pattern', async () => {
    const queue = new InMemoryJobQueue('housekeeping');

    expectOk(
      await registerHousekeepingSchedulers(queue, {
        ...SETTINGS,
        patterns: { 'tmp-sweep': '*/5 * * * *' },
      })
    );

    const registered = expectOk(await queue.getJobSchedulers());
    expect(registered.find((scheduler) => scheduler.id === 'tmp-sweep')?.pattern).toBe(
      '*/5 * * * *'
    );
  });

  it('reports a queue that cannot take a scheduler rather than registering none in silence', async () => {
    expect(
      expectErr(await registerHousekeepingSchedulers(new UnreachableQueue(), SETTINGS)).code
    ).toBe(ErrorCodes.QUEUE_UNAVAILABLE);
  });
});
