import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { createMetricsRegistry } from '@vp/observability';
import { everyInterval } from '../heartbeat';
import { TranscodeProgressReporter } from '../stages/progress-reporter';
import { StreamingSegmentUploader } from '../stages/segment-uploader';
import { transcodeCollaborators } from '../transcode-collaborators';

const logger = createLogger({ format: 'json', service: 'collaborators-spec', level: 'silent' });

describe('apps/worker: transcode collaborators', () => {
  const collaborators = transcodeCollaborators({
    config: inProcessAppConfig(),
    cache: new InMemoryCacheClient(),
    repositories: new InMemoryRepositories(),
    storage: new InMemoryStorageClient(),
    metrics: createMetricsRegistry(),
    now: Date.now,
    every: everyInterval,
  });

  it('reports a rendition through the throttled progress reporter', () => {
    const reporter = collaborators.progressReporter({ videoId: 'v1', rendition: '720p', logger });

    expect(reporter).toBeInstanceOf(TranscodeProgressReporter);
  });

  it('uploads a rendition through the streaming segment uploader', () => {
    const uploader = collaborators.segmentUploader({
      outputDir: '/tmp/vp-collaborators',
      videoId: 'v1',
      generation: 1,
      rendition: '720p',
      logger,
    });

    expect(uploader).toBeInstanceOf(StreamingSegmentUploader);
  });
});
