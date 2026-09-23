import { Adapters, registerAdapters } from '@vp/adapters';
import {
  InMemoryCacheClient,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { overrideAdapters } from '../adapter-set';

async function adapters() {
  return registerAdapters(new Container(), inProcessAppConfig());
}

describe('apps/api/composition: adapter overrides', () => {
  it.each([
    { key: 'repositories', token: Adapters.Repositories, value: new InMemoryRepositories() },
    { key: 'storage', token: Adapters.Storage, value: new InMemoryStorageClient() },
    { key: 'cache', token: Adapters.Cache, value: new InMemoryCacheClient() },
    { key: 'probeQueue', token: Adapters.ProbeQueue, value: new InMemoryJobQueue('probe') },
  ] as const)('hands back the $key a test supplied', async ({ key, token, value }) => {
    const c = overrideAdapters(await adapters(), { [key]: value });

    expect(c.get(token as typeof Adapters.Cache)).toBe(value);
  });

  it('keeps an explicitly supplied queue map and derives the probe queue from it', async () => {
    const probe = new InMemoryJobQueue('probe');
    const c = overrideAdapters(await adapters(), { queues: new Map([['probe', probe]]) });

    expect(c.get(Adapters.ProbeQueue)).toBe(probe);
  });

  it('leaves the configured adapter in place when an override is absent', async () => {
    const c = overrideAdapters(await adapters(), { storage: undefined });

    expect(c.get(Adapters.Storage)).toBeInstanceOf(InMemoryStorageClient);
  });
});
