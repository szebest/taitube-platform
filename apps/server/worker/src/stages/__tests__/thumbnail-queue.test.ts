import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { createMockJob } from '@vp/testing';
import { expectErr } from '@vp/testing/result';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createThumbnailQueueStage } from '../thumbnail-queue';

describe('thumbnail queue stage', () => {
  const stage = createThumbnailQueueStage({
    config: inProcessAppConfig(),
    repositories: new InMemoryRepositories(),
    storage: new InMemoryStorageClient(),
    media: STAGE_SETTINGS.media,
    metrics: STAGE_SETTINGS.metrics,
    logger: createLogger({ format: 'json', service: 'thumbnail-queue-test', level: 'silent' }),
    workerId: STAGE_SETTINGS.workerId,
    progressReporter: () => ({ report: async () => {} }),
  });

  it('refuses a payload that is neither a video thumbnail nor a channel image', async () => {
    const result = await stage(createMockJob('thumbnail', { type: 'unknown' }));

    expectErr(result);
  });
});
