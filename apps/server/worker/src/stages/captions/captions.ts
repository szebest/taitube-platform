import type { QueueJob } from '@vp/core/ports';
import type { CaptionRecord } from '@vp/core/repositories';
import { MS_PER_SECOND } from '@vp/domain/time';
import { type DatabaseUnavailable, ErrorCodes, type StorageUnavailable } from '@vp/errors';
import type { CaptionsJob } from '@vp/job-contracts';
import { assertNever, isErr, ok, type Result } from '@vp/result';
import {
  CAPTIONS_TRACK_HEADERS,
  captionsChunkKey,
  captionsFileKey,
  captionsTmpPrefix,
} from '@vp/storage';
import {
  majorityLanguage,
  mergeWindows,
  parseWindowTranscript,
  toWebVtt,
  type WindowTranscript,
} from '@vp/whisper';
import { type TranscribeFailure, transcribeSpan } from './captions-audio';
import type { CaptionsStageDeps } from './captions-deps';
import {
  type CaptionsScope,
  disableSilentTrack,
  inClaimedStep,
  type Skipped,
} from './captions-run';

export type CaptionsTrackResult =
  | { type: 'track'; outcome: 'ready' | 'failed'; language: string; cues: number }
  | Skipped;

type CaptionsFailure = TranscribeFailure | StorageUnavailable | DatabaseUnavailable;

const UNDETERMINED = 'und';

async function readWindows(
  deps: CaptionsStageDeps,
  job: CaptionsJob,
  windowCount: number
): Promise<Result<WindowTranscript[], CaptionsFailure>> {
  const windows: WindowTranscript[] = [];
  for (let index = 0; index < windowCount; index += 1) {
    const key = captionsChunkKey(job.videoId, job.modelVersion, job.captionVersion, index);
    const body = await deps.storage.getObject(deps.rawBucket, key);
    if (isErr(body)) return body;
    const window = parseWindowTranscript(body.value.toString('utf-8'));
    if (isErr(window)) return window;
    windows.push(window.value);
  }
  return ok(windows);
}

async function transcribeWhole(
  deps: CaptionsStageDeps,
  job: CaptionsJob,
  scope: CaptionsScope
): Promise<Result<WindowTranscript[], CaptionsFailure>> {
  const span = { startMs: 0, durationMs: job.durationMs };
  const transcript = await transcribeSpan(deps, job, span, scope.scratchDir, scope.signal);
  return isErr(transcript) ? transcript : ok([transcript.value]);
}

function recordReady(deps: CaptionsStageDeps, track: CaptionRecord): void {
  deps.metrics.captionsJobsTotal.inc({ outcome: 'ready' });
  deps.metrics.captionsTimeToReady.observe(
    (deps.now() - track.createdAt.getTime()) / MS_PER_SECOND
  );
}

/**
 * Writes the track and its cue rows and moves it to `ready`. The `.vtt` lands before the row, so a
 * listed track always has its file; a run that lost the race to a newer version leaves a file the
 * winner overwrites.
 */
async function publishTrack(
  deps: CaptionsStageDeps,
  job: CaptionsJob,
  track: CaptionRecord,
  windows: WindowTranscript[]
): Promise<Result<CaptionsTrackResult, CaptionsFailure>> {
  const detected = majorityLanguage(windows) ?? null;
  const language = job.language ?? detected ?? UNDETERMINED;
  const cues = mergeWindows(windows);

  const uploaded = await deps.storage.uploadObject({
    bucket: deps.publicBucket,
    key: captionsFileKey(job.videoId, language),
    body: toWebVtt(cues),
    ...CAPTIONS_TRACK_HEADERS,
  });
  if (isErr(uploaded)) return uploaded;

  const committed = await deps.repositories.captions.complete({
    id: job.captionId,
    expectedVersion: job.captionVersion,
    language,
    detectedLanguage: detected,
    cues,
  });
  if (isErr(committed)) return committed;

  switch (committed.value.type) {
    case 'committed':
      recordReady(deps, track);
      return ok({ type: 'track', outcome: 'ready', language, cues: cues.length });
    case 'stale':
      return ok({ type: 'skipped' });
    case 'language-taken': {
      const failed = await deps.repositories.captions.fail({
        id: job.captionId,
        expectedVersion: job.captionVersion,
        status: 'failed',
        reason: 'LANGUAGE_TAKEN',
      });
      if (isErr(failed)) return failed;
      deps.metrics.captionsJobsTotal.inc({ outcome: 'failed' });
      return ok({ type: 'track', outcome: 'failed', language, cues: 0 });
    }
    default:
      return assertNever(committed.value, 'CaptionCommit');
  }
}

/**
 * The run's own job: a short source is transcribed here whole; a long one's `merge` reads the windows
 * its children wrote, in order, and purges them once the track is written.
 */
export function createCaptionsProcessor(deps: CaptionsStageDeps) {
  return async function processCaptions(
    job: QueueJob<CaptionsJob>
  ): Promise<Result<CaptionsTrackResult, CaptionsFailure>> {
    const { plan } = job.data;
    if (plan.type === 'window') return ok({ type: 'skipped' });

    const ran = await inClaimedStep(deps, job, async (scope) => {
      const windows =
        plan.type === 'merge'
          ? await readWindows(deps, job.data, plan.windowCount)
          : await transcribeWhole(deps, job.data, scope);
      if (isErr(windows)) return windows;
      return publishTrack(deps, job.data, scope.track, windows.value);
    });

    if (isErr(ran) && ran.error.code === ErrorCodes.NO_AUDIO_STREAM) {
      return disableSilentTrack(deps, job.data);
    }
    if (plan.type === 'merge' && !isErr(ran)) {
      const purged = await deps.storage.purgePrefix(
        deps.rawBucket,
        captionsTmpPrefix(job.data.videoId)
      );
      if (isErr(purged))
        deps.logger.warn({ videoId: job.data.videoId }, 'captions windows left for the tmp sweep');
    }
    return ran;
  };
}
