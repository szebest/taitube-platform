import type { Repositories } from '@vp/core/repositories';
import type { ScreeningFinding } from '@vp/domain';
import { screenBlankVideo } from '@vp/domain-rules';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { ScreeningConfig } from '@vp/env-schema';
import type { DatabaseUnavailable, MediaFailure } from '@vp/errors';
import { mediaFailureFrom } from '@vp/errors';
import { type FfmpegProcessLimits } from '@vp/ffmpeg';
import { type FingerprintTools, findMatches, storeFingerprint } from '@vp/fingerprint';
import { type Result, fromPromise, isErr, ok } from '@vp/result';
import { matchFinding } from './match-finding';

export interface FingerprintFindingsDeps {
  repositories: Pick<Repositories, 'fingerprints' | 'videos'>;
  fingerprint: Pick<FingerprintTools, 'sampleFrames' | 'runFpcalc'>;
  ffmpegPath: string;
  fpcalcPath: string;
  limits: FfmpegProcessLimits;
  screening: Pick<ScreeningConfig, 'thresholds' | 'sampling' | 'process'>;
}

export interface FingerprintInput {
  videoId: string;
  ownerId: string;
  sourcePath: string;
  durationMs: number;
  hasAudio: boolean;
  signal: AbortSignal;
}

/**
 * Fingerprints the video, looks it up against every other stored video, then stores it for the
 * uploads after it. Also reads the same frames for a blank or frozen picture. A match with a video
 * that is gone is not evidence of anything and is left out.
 */
export async function fingerprintFindings(
  deps: FingerprintFindingsDeps,
  input: FingerprintInput
): Promise<Result<ScreeningFinding[], MediaFailure | DatabaseUnavailable>> {
  const { screening, limits } = deps;
  const { thresholds, sampling, process } = screening;
  const timeoutMs = Math.max(process.minTimeoutMs, input.durationMs * process.timeoutFactor);
  const failure = (cause: unknown) => mediaFailureFrom('screen', cause);

  const [frames, chromaprint] = await Promise.all([
    fromPromise(
      () =>
        deps.fingerprint.sampleFrames({
          ffmpegPath: deps.ffmpegPath,
          sourcePath: input.sourcePath,
          intervalSeconds: sampling.hashIntervalSeconds,
          timeoutMs,
          limits,
          signal: input.signal,
        }),
      failure
    ),
    input.hasAudio
      ? fromPromise(
          () =>
            deps.fingerprint.runFpcalc({
              fpcalcPath: deps.fpcalcPath,
              sourcePath: input.sourcePath,
              durationSeconds: input.durationMs / MS_PER_SECOND,
              timeoutMs,
              limits,
              signal: input.signal,
            }),
          failure
        )
      : Promise.resolve(ok({ durationSeconds: 0, terms: [] as number[] })),
  ]);
  if (isErr(frames)) return frames;
  if (isErr(chromaprint)) return chromaprint;

  const fingerprint = {
    videoId: input.videoId,
    frames: frames.value,
    audioTerms: chromaprint.value.terms,
  };
  const settings = {
    thresholds,
    hashIntervalSeconds: sampling.hashIntervalSeconds,
    audioIndexStride: sampling.audioIndexStride,
  };
  const matches = await findMatches(deps.repositories.fingerprints, fingerprint, settings);
  if (isErr(matches)) return matches;
  const stored = await storeFingerprint(deps.repositories.fingerprints, fingerprint, settings);
  if (isErr(stored)) return stored;

  const findings: ScreeningFinding[] = [];
  for (const match of matches.value.slice(0, process.maxMatches)) {
    const original = await deps.repositories.videos.findById(match.videoId);
    if (isErr(original)) return original;
    if (!original.value || original.value.deletedAt) continue;
    findings.push(matchFinding(match, original.value, input.ownerId, thresholds));
  }

  const blank = screenBlankVideo(frames.value, thresholds);
  return ok(blank ? [...findings, blank] : findings);
}
