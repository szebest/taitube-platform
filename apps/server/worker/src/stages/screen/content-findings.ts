import type { FrameClassifier, StorageClient } from '@vp/core/ports';
import type { ScreeningFinding } from '@vp/domain';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { ScreeningConfig } from '@vp/env-schema';
import { type MediaFailure, type StorageUnavailable, mediaFailureFrom } from '@vp/errors';
import type { FfmpegProcessLimits } from '@vp/ffmpeg';
import { classifierTimestamps, type FingerprintTools } from '@vp/fingerprint';
import { type Result, fromPromise, isErr, ok } from '@vp/result';
import { evidenceFrameKey } from '@vp/storage';
import { readNsfw } from './nsfw-finding';

export interface ContentFindingsDeps {
  storage: StorageClient;
  classifier: FrameClassifier;
  fingerprint: Pick<FingerprintTools, 'sampleClassifierFrames' | 'extractEvidenceFrame'>;
  rawBucket: string;
  ffmpegPath: string;
  limits: FfmpegProcessLimits;
  screening: Pick<ScreeningConfig, 'thresholds' | 'sampling' | 'process'>;
}

export interface ContentInput {
  videoId: string;
  sourcePath: string;
  durationMs: number;
  signal: AbortSignal;
}

/**
 * Scores a frame every few seconds, plus the first, middle and last, for the `nsfw` label. The
 * strongest flagged frames are kept as small JPEGs under the video's evidence prefix, for the
 * moderator that decides the case.
 */
export async function contentFindings(
  deps: ContentFindingsDeps,
  input: ContentInput
): Promise<Result<ScreeningFinding[], MediaFailure | StorageUnavailable>> {
  const { classifier, screening, limits } = deps;
  const { process } = screening;

  const decoded = await fromPromise(
    () =>
      deps.fingerprint.sampleClassifierFrames({
        ffmpegPath: deps.ffmpegPath,
        sourcePath: input.sourcePath,
        timestampsSeconds: classifierTimestamps(
          input.durationMs / MS_PER_SECOND,
          screening.sampling
        ),
        size: classifier.inputSize,
        concurrency: process.decodeConcurrency,
        timeoutMs: process.frameTimeoutMs,
        limits,
        signal: input.signal,
      }),
    (cause) => mediaFailureFrom('screen', cause)
  );
  if (isErr(decoded)) return decoded;

  const scores = await classifier.classify(decoded.value.map(({ frame }) => frame));
  if (isErr(scores)) return scores;

  const reading = readNsfw(
    decoded.value.map(({ timestampSeconds }, index) => ({
      timestampSeconds,
      score: scores.value[index]?.nsfw ?? 0,
    })),
    screening.thresholds
  );
  if (!reading.finding) return ok([]);

  const evidence: { key: string; timestampSeconds: number; score: number }[] = [];
  for (const [index, frame] of reading.flagged.slice(0, process.evidenceFrames).entries()) {
    const jpeg = await fromPromise(
      () =>
        deps.fingerprint.extractEvidenceFrame({
          ffmpegPath: deps.ffmpegPath,
          sourcePath: input.sourcePath,
          timestampSeconds: frame.timestampSeconds,
          widthPixels: process.evidenceWidthPixels,
          timeoutMs: process.frameTimeoutMs,
          limits,
          signal: input.signal,
        }),
      (cause) => mediaFailureFrom('screen', cause)
    );
    if (isErr(jpeg)) return jpeg;

    const key = evidenceFrameKey(input.videoId, index);
    const uploaded = await deps.storage.uploadObject({
      bucket: deps.rawBucket,
      key,
      body: jpeg.value,
      contentType: 'image/jpeg',
    });
    if (isErr(uploaded)) return uploaded;
    evidence.push({ key, timestampSeconds: frame.timestampSeconds, score: frame.score });
  }

  return ok([{ ...reading.finding, evidence: { ...reading.finding.evidence, frames: evidence } }]);
}
