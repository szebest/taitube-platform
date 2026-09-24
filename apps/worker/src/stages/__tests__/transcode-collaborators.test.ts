import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { createLogger, createMetricsRegistry } from '@vp/observability';
import { TranscodeProgressReporter } from '../progress-reporter';
import { StreamingSegmentUploader } from '../segment-uploader';
import { transcodeCollaborators } from '../transcode-collaborators';

const logger = createLogger({ service: 'collaborators-spec', level: 'silent' });

describe('apps/worker: transcode collaborators', () => {
  const collaborators = transcodeCollaborators({
    config: inProcessAppConfig(),
    cache: new InMemoryCacheClient(),
    repositories: new InMemoryRepositories(),
    storage: new InMemoryStorageClient(),
    metrics: createMetricsRegistry(),
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
