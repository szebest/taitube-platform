import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { PostgresDatabaseClient } from '../../postgres/postgres-database-client';
import { RedisSubscriptionCacheAdapter } from '../../redis/redis-subscription-cache.adapter';
import { S3MultipartStorage } from '../../s3/s3-multipart-storage';
import { S3StorageClient } from '../../s3/s3-storage-client';
import { Adapters } from '../adapter-tokens';
import { registerFamily } from '../external-family';

function family(): Container {
  const config = { ...inProcessAppConfig(), kind: 'external' as const };
  const c = new Container().provide(Adapters.Config, () => config);
  registerFamily(c);
  return c;
}

describe('external adapter family', () => {
  it('connects each driver from the configuration it was handed', async () => {
    const c = family();

    expect(c.get(Adapters.DbClient)).toBeInstanceOf(PostgresDatabaseClient);
    expect(c.get(Adapters.Storage)).toBeInstanceOf(S3StorageClient);
    expect(await (c.get(Adapters.Storage) as S3StorageClient).getRawClient().config.region()).toBe(
      'us-east-1'
    );
    await c.dispose();
  });

  it('builds multipart over the one S3 client, and closes that client once', async () => {
    const c = family();
    const multipart = c.get(Adapters.Multipart);
    const storage = c.get(Adapters.Storage) as S3StorageClient;
    const close = vi.spyOn(storage, 'close');

    expect(multipart).toBeInstanceOf(S3MultipartStorage);
    await c.dispose();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps the subscription cache on Redis when a test overrides the cache port', async () => {
    const c = family().override(Adapters.Cache, new InMemoryCacheClient());

    expect(c.get(Adapters.SubscriptionCache)).toBeInstanceOf(RedisSubscriptionCacheAdapter);
    await c.dispose();
  });
});
