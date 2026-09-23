import { InMemoryJobQueue } from '@vp/adapters';
import type { JobSchedulerTemplate, UpsertJobSchedulerOptions } from '@vp/core/ports';
import { ErrorCodes, type QueueUnavailable, queueUnavailable } from '@vp/errors';
import { type Result, err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  HOUSEKEEPING_SCHEDULER_CONFIGS,
  registerHousekeepingSchedulers,
} from '../housekeeping-schedulers';

class UnreachableQueue extends InMemoryJobQueue {
  override async upsertJobScheduler<T = unknown>(
    _id: string,
    _repeatOpts: UpsertJobSchedulerOptions,
    _template?: JobSchedulerTemplate<T>
  ): Promise<Result<unknown, QueueUnavailable>> {
    return err(queueUnavailable('upsertJobScheduler'));
  }
}

describe('apps/api/services: housekeeping schedulers', () => {
  it('registers every configured scheduler with its cron pattern', async () => {
    const queue = new InMemoryJobQueue('housekeeping');

    expectOk(await registerHousekeepingSchedulers(queue));

    const registered = expectOk(await queue.getJobSchedulers());
    expect(registered.map((scheduler) => scheduler.id).sort()).toEqual(
      HOUSEKEEPING_SCHEDULER_CONFIGS.map((config) => config.id).sort()
    );
    expect(registered.find((scheduler) => scheduler.id === 'purge-deleted')?.pattern).toBe(
      '0 * * * *'
    );
  });

  it('takes an override for a scheduler pattern', async () => {
    const queue = new InMemoryJobQueue('housekeeping');

    expectOk(await registerHousekeepingSchedulers(queue, { 'tmp-sweep': '*/5 * * * *' }));

    const registered = expectOk(await queue.getJobSchedulers());
    expect(registered.find((scheduler) => scheduler.id === 'tmp-sweep')?.pattern).toBe(
      '*/5 * * * *'
    );
  });

  it('reports a queue that cannot take a scheduler rather than registering none in silence', async () => {
    expect(expectErr(await registerHousekeepingSchedulers(new UnreachableQueue())).code).toBe(
      ErrorCodes.QUEUE_UNAVAILABLE
    );
  });
});
