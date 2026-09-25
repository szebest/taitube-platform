import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { createMetricsRegistry } from '@vp/observability';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import type { MeteredMultipartStorage } from '../../metered/metered-multipart-storage';
import type { MeteredStorageClient } from '../../metered/metered-storage-client';
import { PostgresDatabaseClient } from '../../postgres/postgres-database-client';
import { RedisSubscriptionCacheAdapter } from '../../redis/redis-subscription-cache.adapter';
import { FallbackViewBuffer } from '../../resilient/fallback-view-buffer';
import { S3MultipartStorage } from '../../s3/s3-multipart-storage';
import { S3StorageClient } from '../../s3/s3-storage-client';
import { Adapters } from '../adapter-tokens';
import { registerFamily } from '../external-family';

function family(): Container {
  const config = inProcessAppConfig({ kind: 'external', postgres: { poolMax: 3 } });
  const c = new Container()
    .provide(Adapters.Config, () => config)
    .provide(Adapters.Metrics, () => createMetricsRegistry());
  registerFamily(c);
  return c;
}

describe('external adapter family', () => {
  it('connects each driver from the configuration it was handed', async () => {
    const c = family();

    expect(c.get(Adapters.DbClient)).toBeInstanceOf(PostgresDatabaseClient);
    const storage = c.get(Adapters.Storage) as MeteredStorageClient;
    expect(storage.inner).toBeInstanceOf(S3StorageClient);
    expect(await (storage.inner as S3StorageClient).getRawClient().config.region()).toBe(
      'us-east-1'
    );
    await c.dispose();
  });

  it('opens one postgres pool, sized as configured, and ends it once', async () => {
    const c = family();
    c.get(Adapters.Repositories);
    const pool = (c.get(Adapters.DbClient) as PostgresDatabaseClient).getRawSql();
    const end = vi.spyOn(pool, 'end');

    expect(pool.options.max).toBe(3);
    await c.dispose();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('builds multipart over the one S3 client, and closes that client once', async () => {
    const c = family();
    const multipart = c.get(Adapters.Multipart) as MeteredMultipartStorage;
    const storage = (c.get(Adapters.Storage) as MeteredStorageClient).inner;
    const close = vi.spyOn(storage, 'close');

    expect(multipart.inner).toBeInstanceOf(S3MultipartStorage);
    await c.dispose();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps the subscription cache on Redis when a test overrides the cache port', async () => {
    const c = family().override(Adapters.Cache, new InMemoryCacheClient());

    expect(c.get(Adapters.SubscriptionCache)).toBeInstanceOf(RedisSubscriptionCacheAdapter);
    expect(c.get(Adapters.ViewBuffer)).toBeInstanceOf(FallbackViewBuffer);
    await c.dispose();
  });
});
