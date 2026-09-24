import { InMemoryCacheClient, InMemoryJobQueue } from '@vp/adapters/in-memory';
import type {
  JobSchedulerTemplate,
  PatternMessageListener,
  UpsertJobSchedulerOptions,
} from '@vp/core/ports';
import { inProcessAppConfig } from '@vp/env-schema';
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
    const { app, container } = await composeApp({
      config: inProcessAppConfig(),
      adapters: { cache: new UnsubscribableCache() },
    });

    const failed = expectErr(await container.start());

    expect(failed).toMatchObject({ type: 'failed', cause: { code: ErrorCodes.CACHE_UNAVAILABLE } });
    await app.close();
  });

  it('refuses to start when the housekeeping schedulers cannot be registered', async () => {
    const { app, container } = await composeApp({
      config: inProcessAppConfig(),
      adapters: { queues: queuesWith(new UnschedulableQueue('housekeeping')) },
    });

    const failed = expectErr(await container.start());

    expect(failed).toMatchObject({
      type: 'failed',
      token: 'HousekeepingQueue',
      cause: { code: ErrorCodes.QUEUE_UNAVAILABLE },
    });
    await app.close();
  });

  it('builds the whole app without opening a timer or a subscription, and closes cleanly', async () => {
    const before = timers();
    const cache = new InMemoryCacheClient();
    const subscribe = vi.spyOn(cache, 'subscribe');
    const psubscribe = vi.spyOn(cache, 'psubscribe');

    const app = await buildApp({ config: inProcessAppConfig(), adapters: { cache } });
    await app.ready();

    expect(timers()).toBe(before);
    expect(subscribe).not.toHaveBeenCalled();
    expect(psubscribe).not.toHaveBeenCalled();
    expect(app.printRoutes()).toContain('uploads');
    await app.close();
  });

  it('starts the pollers and the subscription only when asked, and stops them on close', async () => {
    const before = timers();
    const cache = new InMemoryCacheClient();
    const psubscribe = vi.spyOn(cache, 'psubscribe');
    const { app, container } = await composeApp({
      config: inProcessAppConfig(),
      adapters: { cache },
    });

    expectOk(await container.start());
    expect(timers()).toBeGreaterThan(before);
    expect(psubscribe).toHaveBeenCalled();

    await app.close();
    expect(timers()).toBe(before);
  });
});
