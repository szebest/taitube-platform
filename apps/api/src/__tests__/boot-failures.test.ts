import { InMemoryCacheClient, InMemoryJobQueue } from '@vp/adapters';
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
import { buildApp } from '../app';

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

describe('apps/api: a dependency the API cannot boot without fails the boot', () => {
  it('refuses to start on a cache that cannot take the SSE subscription', async () => {
    await expect(buildApp({ adapters: { cache: new UnsubscribableCache() } })).rejects.toMatchObject(
      { code: ErrorCodes.CACHE_UNAVAILABLE }
    );
  });

  it('refuses to start when the housekeeping schedulers cannot be registered', async () => {
    await expect(
      buildApp({ adapters: { queues: queuesWith(new UnschedulableQueue('housekeeping')) } })
    ).rejects.toMatchObject({ code: ErrorCodes.QUEUE_UNAVAILABLE });
  });

  it('starts on adapters that answer, and closes cleanly', async () => {
    const app = await buildApp({});

    await app.ready();
    await app.close();

    expect(app.printRoutes()).toContain('uploads');
  });
});
