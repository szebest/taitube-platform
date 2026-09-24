import {
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/observability';
import { createWorkerRunner } from '../runner';
import { inMemoryQueues } from '../stages/housekeeping/__tests__/housekeeping-harness';
import { STAGE_SETTINGS } from './stage-settings';

describe('housekeeping worker runner', () => {
  it('starts a worker on the housekeeping queue', async () => {
    const storage = new InMemoryStorageClient();
    const runner = await createWorkerRunner({
      config: inProcessAppConfig({ worker: { stage: 'housekeeping' } }),
      adapters: {
        repositories: new InMemoryRepositories(),
        storage,
        multipart: new InMemoryMultipartStorage(storage),
        getQueue: inMemoryQueues(),
      },
      logger: createLogger({ service: 'housekeeping-spec', level: 'silent' }),
      media: STAGE_SETTINGS.media,
      workerId: STAGE_SETTINGS.workerId,
    });

    expect(runner.worker.name).toBe('housekeeping');
    await runner.close();
  });
});
