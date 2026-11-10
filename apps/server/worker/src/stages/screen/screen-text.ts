import type { Repositories } from '@vp/core/repositories';
import { screenTranscript } from '@vp/domain-rules';
import type { ScreeningConfig } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface ScreenTextDeps {
  repositories: Pick<Repositories, 'videos' | 'captions' | 'screenings'>;
  screening: Pick<ScreeningConfig, 'enabled' | 'thresholds'>;
}

export interface ScreenTextInput {
  videoId: string;
  captionId: string;
  language: string;
}

/**
 * The `screen-text` pass over a finished transcript: its cue rows against the profanity list. A video
 * without cue rows, one that is gone or not yet public, and a deployment with screening off are no-ops.
 * Answers whether a flag was raised.
 */
export async function screenText(
  deps: ScreenTextDeps,
  input: ScreenTextInput
): Promise<Result<boolean, DatabaseUnavailable>> {
  const { repositories, screening } = deps;
  if (!screening.enabled) return ok(false);

  const video = await repositories.videos.findById(input.videoId);
  if (isErr(video)) return video;
  if (!(video.value && (video.value.status === 'READY' || video.value.status === 'HELD')))
    return ok(false);

  const cues = await repositories.captions.cues(input.captionId);
  if (isErr(cues)) return cues;
  if (cues.value.length === 0) return ok(false);

  const finding = screenTranscript(
    cues.value.map(({ text }) => text).join(' '),
    input.language,
    screening.thresholds
  );
  if (!finding) return ok(false);

  return repositories.screenings.raiseFlag({
    id: uuidv7(),
    videoId: input.videoId,
    finding,
    thresholdVersion: screening.thresholds.version,
  });
}
