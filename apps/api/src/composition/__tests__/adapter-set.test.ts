import {
  InMemoryCacheClient,
  InMemoryDatabaseClient,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
  InMemorySubscriptionCache,
  PostgresDatabaseClient,
  PostgresRepositories,
  RedisCacheClient,
  S3MultipartStorage,
  S3StorageClient,
} from '@vp/adapters';
import { QUEUES } from '@vp/job-contracts';
import { resolveAdapterSet } from '../adapter-set';

describe('apps/api/composition: adapter set', () => {
  it('builds the in-memory family when asked for it', () => {
    const adapters = resolveAdapterSet({ kind: 'in-memory' });

    expect(adapters.dbClient).toBeInstanceOf(InMemoryDatabaseClient);
    expect(adapters.repositories).toBeInstanceOf(InMemoryRepositories);
    expect(adapters.storage).toBeInstanceOf(InMemoryStorageClient);
    expect(adapters.cache).toBeInstanceOf(InMemoryCacheClient);
    expect(adapters.multipart).toBeInstanceOf(InMemoryMultipartStorage);
    expect(adapters.subscriptionCache).toBeInstanceOf(InMemorySubscriptionCache);
  });

  it('builds the external family when asked for it', () => {
    const adapters = resolveAdapterSet({ kind: 'external' });

    expect(adapters.dbClient).toBeInstanceOf(PostgresDatabaseClient);
    expect(adapters.repositories).toBeInstanceOf(PostgresRepositories);
    expect(adapters.storage).toBeInstanceOf(S3StorageClient);
    expect(adapters.cache).toBeInstanceOf(RedisCacheClient);
    expect(adapters.multipart).toBeInstanceOf(S3MultipartStorage);
  });

  it('does not infer the family from the objects it is handed', () => {
    const adapters = resolveAdapterSet({ kind: 'external', cache: new InMemoryCacheClient() });

    expect(adapters.cache).toBeInstanceOf(InMemoryCacheClient);
    expect(adapters.repositories).toBeInstanceOf(PostgresRepositories);
  });

  it('defaults to in-memory under NODE_ENV=test', () => {
    expect(process.env['NODE_ENV']).toBe('test');
    expect(resolveAdapterSet().repositories).toBeInstanceOf(InMemoryRepositories);
  });

  it('opens one queue per declared stage and points the probe queue at its own', () => {
    const adapters = resolveAdapterSet({ kind: 'in-memory' });

    expect([...adapters.queues.keys()]).toEqual([...QUEUES]);
    expect(adapters.probeQueue).toBe(adapters.queues.get('probe'));
  });

  it('keeps an explicitly supplied queue map and probe queue', () => {
    const probeQueue = new InMemoryJobQueue('probe');
    const queues = new Map([['probe', probeQueue]]);

    const adapters = resolveAdapterSet({ kind: 'in-memory', queues });

    expect(adapters.queues).toBe(queues);
    expect(adapters.probeQueue).toBe(probeQueue);
  });

  it('passes every override through untouched', () => {
    const repositories = new InMemoryRepositories();
    const storage = new InMemoryStorageClient();

    const adapters = resolveAdapterSet({ kind: 'in-memory', repositories, storage });

    expect(adapters.repositories).toBe(repositories);
    expect(adapters.storage).toBe(storage);
  });
});
