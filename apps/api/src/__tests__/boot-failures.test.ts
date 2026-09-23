import { InMemoryCacheClient, InMemoryJobQueue } from '@vp/adapters/in-memory';
import type {
  JobSchedulerTemplate,
  PatternMessageListener,
  UpsertJobSchedulerOptions,
} from '@vp/core/ports';
import {
  type CacheUnavailable,
  ErrorCodes,
  type QueueUnavailable,
  cacheUnavailable,
  queueUnavailable,
} from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import { type Result, err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { buildApp, composeApp } from '../app';

class UnsubscribableCache extends InMemoryCacheClient {
  override async psubscribe(
    _pattern: string,
    _listener: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    return err(cacheUnavailable('psubscribe'));
  }
}

class UnschedulableQueue extends InMemoryJobQueue {
  override async upsertJobScheduler<T = unknown>(
    _id: string,
    _repeatOpts: UpsertJobSchedulerOptions,
    _template?: JobSchedulerTemplate<T>
  ): Promise<Result<unknown, QueueUnavailable>> {
    return err(queueUnavailable('upsertJobScheduler'));
  }
}

function queuesWith(housekeeping: InMemoryJobQueue): Map<string, InMemoryJobQueue> {
  const queues = new Map<string, InMemoryJobQueue>();
  for (const name of QUEUES) {
    queues.set(name, name === 'housekeeping' ? housekeeping : new InMemoryJobQueue(name));
  }
  return queues;
}

function timers(): number {
  return process.getActiveResourcesInfo().filter((resource) => resource === 'Timeout').length;
}

describe('apps/api: a dependency the API cannot boot without fails the start', () => {
  it('refuses to start on a cache that cannot take the SSE subscription', async () => {
    const { app, container } = await composeApp({ adapters: { cache: new UnsubscribableCache() } });

    const failed = expectErr(await container.start());

    expect(failed.cause).toMatchObject({ code: ErrorCodes.CACHE_UNAVAILABLE });
    await app.close();
  });

  it('refuses to start when the housekeeping schedulers cannot be registered', async () => {
    const { app, container } = await composeApp({
      adapters: { queues: queuesWith(new UnschedulableQueue('housekeeping')) },
    });

    const failed = expectErr(await container.start());

    expect(failed).toMatchObject({
      token: 'HousekeepingQueue',
      cause: { code: ErrorCodes.QUEUE_UNAVAILABLE },
    });
    await app.close();
  });

  it('builds the whole app without opening a timer, and closes cleanly', async () => {
    const before = timers();

    const app = await buildApp({});
    await app.ready();

    expect(timers()).toBe(before);
    expect(app.printRoutes()).toContain('uploads');
    await app.close();
  });

  it('starts the pollers only when asked, and stops them on close', async () => {
    const before = timers();
    const { app, container } = await composeApp({});

    expectOk(await container.start());
    expect(timers()).toBeGreaterThan(before);

    await app.close();
    expect(timers()).toBe(before);
  });
});
