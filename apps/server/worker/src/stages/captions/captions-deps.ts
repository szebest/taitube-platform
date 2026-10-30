import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { CaptionsConfig, CdnBase } from '@vp/env-schema';
import type { FfmpegProcessLimits, MediaTools } from '@vp/ffmpeg';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import type { SpeechTools } from '@vp/whisper';

export interface CaptionsStageDeps {
  repositories: Repositories;
  storage: StorageClient;
  media: MediaTools;
  speech: SpeechTools;
  metrics: PipelineMetrics;
  rawBucket: string;
  publicBucket: string;
  cdn: CdnBase;
  workerId: string;
  logger: Logger;
  tmpDir: string;
  now: () => number;
  ffmpeg: {
    path: string;
    limits: FfmpegProcessLimits;
    timeoutFactor: number;
    minTimeoutMs: number;
  };
  captions: CaptionsConfig;
}
