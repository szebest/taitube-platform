import { InMemoryCacheClient, InMemoryDatabaseClient } from '@vp/adapters/in-memory';
import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { ReadinessService } from '../readiness-service';

describe('apps/api/services: ReadinessService', () => {
  it('is ready when every dependency answers', async () => {
    const readiness = new ReadinessService({
      postgres: new InMemoryDatabaseClient(),
      redis: new InMemoryCacheClient(),
    });

    expect(await readiness.report()).toEqual({
      ready: true,
      checks: { postgres: 'ok', redis: 'ok' },
    });
  });

  it('names the dependency that does not answer', async () => {
    const postgres = Object.assign(new InMemoryDatabaseClient(), {
      checkHealth: async () => err(databaseUnavailable('ping')),
    });
    const readiness = new ReadinessService({ postgres, redis: new InMemoryCacheClient() });

    expect(await readiness.report()).toEqual({
      ready: false,
      checks: { postgres: 'failed', redis: 'ok' },
    });
  });

  it('answers not-ready once draining, without asking any dependency', async () => {
    const postgres = new InMemoryDatabaseClient();
    const checkHealth = vi.spyOn(postgres, 'checkHealth');
    const readiness = new ReadinessService({ postgres });

    readiness.beginDrain();

    expect(await readiness.report()).toEqual({ ready: false, checks: {} });
    expect(checkHealth).not.toHaveBeenCalled();
  });
});
