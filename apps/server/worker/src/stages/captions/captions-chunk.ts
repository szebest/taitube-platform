import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { type CaptionsJob, captionsWindow } from '@vp/job-contracts';
import { isErr, ok, type Result } from '@vp/result';
import { captionsChunkKey } from '@vp/storage';
import { ownedCues, type WindowTranscript } from '@vp/whisper';
import type { TranscribeFailure } from './captions-audio';
import { transcribeSpan } from './captions-audio';
import type { CaptionsStageDeps } from './captions-deps';
import { disableSilentTrack, inClaimedStep, type Skipped } from './captions-run';

export type CaptionsWindowResult = { type: 'window'; index: number; cues: number } | Skipped;

/**
 * Transcribes one window with its lead-in and tail, keeps the cues it owns and leaves them in the
 * raw bucket for the merge. A replay overwrites the same key with the same cues.
 */
export function createCaptionsChunkProcessor(deps: CaptionsStageDeps) {
  return async function processCaptionsWindow(
    job: QueueJob<CaptionsJob>
  ): Promise<Result<CaptionsWindowResult, TranscribeFailure>> {
    const { plan, videoId, modelVersion, captionVersion, durationMs } = job.data;
    if (plan.type !== 'window') return ok({ type: 'skipped' });
    const window = captionsWindow(plan.index, plan.windowCount, durationMs);

    const ran = await inClaimedStep(deps, job, async ({ scratchDir, signal }) => {
      const transcript = await transcribeSpan(deps, job.data, window, scratchDir, signal);
      if (isErr(transcript)) return transcript;

      const owned: WindowTranscript = {
        language: transcript.value.language,
        cues: ownedCues(window, transcript.value.cues),
      };
      const uploaded = await deps.storage.uploadObject({
        bucket: deps.rawBucket,
        key: captionsChunkKey(videoId, modelVersion, captionVersion, plan.index),
        body: JSON.stringify(owned),
        contentType: 'application/json',
      });
      if (isErr(uploaded)) return uploaded;
      return ok({ type: 'window' as const, index: plan.index, cues: owned.cues.length });
    });

    if (isErr(ran) && ran.error.code === ErrorCodes.NO_AUDIO_STREAM) {
      return disableSilentTrack(deps, job.data);
    }
    return ran;
  };
}
