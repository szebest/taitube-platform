import type { CacheClient, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { PipelineMetrics } from '@vp/observability';
import { TranscodeProgressReporter } from './stages/progress-reporter';
import { StreamingSegmentUploader } from './stages/segment-uploader';
import type { TranscodeProcessorDeps } from './stages/transcode';

interface CollaboratorDeps {
  config: AppConfig;
  cache: CacheClient;
  repositories: Repositories;
  storage: StorageClient;
  metrics: PipelineMetrics;
  now: () => number;
}

/** The per-job collaborators a transcode builds from what the stage was handed. */
export function transcodeCollaborators(
  d: CollaboratorDeps
): Pick<TranscodeProcessorDeps, 'progressReporter' | 'segmentUploader'> {
  return {
    progressReporter: (target) =>
      new TranscodeProgressReporter({
        cache: d.cache,
        repositories: d.repositories,
        metrics: d.metrics,
        now: d.now,
        ...target,
      }),
    segmentUploader: (target) =>
      new StreamingSegmentUploader({
        storage: d.storage,
        publicBucket: d.config.buckets.public,
        ...d.config.worker.segmentUpload,
        ...target,
      }),
  };
}
