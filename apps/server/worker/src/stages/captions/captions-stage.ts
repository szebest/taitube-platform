import type { QueueJob } from '@vp/core/ports';
import type { AppConfig } from '@vp/env-schema';
import type { CaptionsJob } from '@vp/job-contracts';
import { createCaptionsProcessor } from './captions';
import { createCaptionsChunkProcessor } from './captions-chunk';
import type { CaptionsStageDeps } from './captions-deps';

type StageCollaborators = Omit<
  CaptionsStageDeps,
  'rawBucket' | 'publicBucket' | 'cdn' | 'tmpDir' | 'ffmpeg' | 'captions'
> & { config: AppConfig };

/** Windows and the run's own job share the queue; the plan says which one a job is. */
export function createCaptionsStage(d: StageCollaborators) {
  const { config, ...collaborators } = d;
  const deps: CaptionsStageDeps = {
    ...collaborators,
    rawBucket: config.buckets.raw,
    publicBucket: config.buckets.public,
    cdn: config.cdn,
    tmpDir: config.worker.tmpDir,
    ffmpeg: {
      path: config.worker.ffmpegPath,
      limits: config.worker.ffmpegProcess,
      timeoutFactor: config.worker.jobTimeoutFactor,
      minTimeoutMs: config.worker.ffmpegProcess.minTranscodeTimeoutMs,
    },
    captions: config.captions,
  };
  const track = createCaptionsProcessor(deps);
  const window = createCaptionsChunkProcessor(deps);
  return (job: QueueJob<CaptionsJob>) =>
    job.data.plan.type === 'window' ? window(job) : track(job);
}
