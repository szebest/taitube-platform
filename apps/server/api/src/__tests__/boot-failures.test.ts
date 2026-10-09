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
import { type Result, err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { buildTestApp, inMemoryQueues } from './test-app';

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

describe('apps/api: a dependency the API cannot boot without fails the start', () => {
  it('refuses to start on a cache that cannot take the SSE subscription', async () => {
    const { app, container } = await buildTestApp({
      adapters: { cache: new UnsubscribableCache() },
    });

    const failed = expectErr(await container.start());

    expect(failed).toMatchObject({ type: 'failed', cause: { code: ErrorCodes.CACHE_UNAVAILABLE } });
    await app.close();
  });

  it('refuses to start when the housekeeping schedulers cannot be registered', async () => {
    const { app, container } = await buildTestApp({
      adapters: { queues: inMemoryQueues(new UnschedulableQueue('housekeeping')) },
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
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const cache = new InMemoryCacheClient();
    const subscribe = vi.spyOn(cache, 'subscribe');
    const psubscribe = vi.spyOn(cache, 'psubscribe');

    const { app } = await buildTestApp({ adapters: { cache } });
    await app.ready();

    expect(intervals).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(psubscribe).not.toHaveBeenCalled();
    expect(app.printRoutes()).toContain('uploads');
    await app.close();
  });

  it('starts the pollers and the subscription only when asked, and stops them on close', async () => {
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const cleared = vi.spyOn(globalThis, 'clearInterval');
    const cache = new InMemoryCacheClient();
    const psubscribe = vi.spyOn(cache, 'psubscribe');
    const { app, container } = await buildTestApp({ adapters: { cache } });

    expectOk(await container.start());
    expect(intervals).toHaveBeenCalled();
    expect(psubscribe).toHaveBeenCalled();

    await app.close();
    const opened = intervals.mock.results.map((result) => result.value);
    const closed = cleared.mock.calls.map(([handle]) => handle);
    expect(closed).toEqual(expect.arrayContaining(opened));
  });
});
