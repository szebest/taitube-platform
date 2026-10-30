import * as path from 'node:path';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  mediaFailure,
  mediaFailureFrom,
  type StorageUnavailable,
} from '@vp/errors';
import type { CaptionsJob } from '@vp/job-contracts';
import { LadderEntry } from '@vp/job-contracts';
import { err, fromPromise, isErr, isOk, ok, type Result } from '@vp/result';
import { renditionPlaylistKey } from '@vp/storage';
import type { WhisperTranscript } from '@vp/whisper';
import { z } from 'zod';
import type { CaptionsStageDeps } from './captions-deps';

export type TranscribeFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

/**
 * The raw source, range-read through a presigned URL. Only after the raw source has expired does a
 * run fall back to the audio of the smallest finished rendition.
 */
async function audioSource(
  deps: CaptionsStageDeps,
  job: CaptionsJob
): Promise<Result<string, TranscribeFailure>> {
  const head = await deps.storage.headObject(deps.rawBucket, job.sourceKey);
  if (isErr(head)) return head;
  if (head.value) {
    return deps.storage.createPresignedGetUrl({
      bucket: deps.rawBucket,
      key: job.sourceKey,
      expiresInSeconds: deps.captions.process.presignSeconds,
    });
  }

  const video = await deps.repositories.videos.findById(job.videoId);
  if (isErr(video)) return video;
  const ladder = z.array(LadderEntry).safeParse(video.value?.ladder);
  const smallest = ladder.success ? ladder.data.at(-1) : undefined;
  if (!(video.value && smallest)) {
    return err(
      mediaFailure(
        'captions',
        ErrorCodes.SOURCE_MISSING,
        `no source or rendition for ${job.videoId}`
      )
    );
  }

  deps.logger.info({ videoId: job.videoId }, 'raw source gone; transcribing a rendition');
  return ok(
    `${deps.cdn}/${renditionPlaylistKey(job.videoId, smallest.name, video.value.generation)}`
  );
}

/** Extracts one span of audio and transcribes it, recording how fast whisper ran. */
export async function transcribeSpan(
  deps: CaptionsStageDeps,
  job: CaptionsJob,
  span: { startMs: number; durationMs: number },
  scratchDir: string,
  signal: AbortSignal
): Promise<Result<WhisperTranscript, TranscribeFailure>> {
  const source = await audioSource(deps, job);
  if (isErr(source)) return source;

  const timeoutMs = Math.max(deps.ffmpeg.timeoutFactor * span.durationMs, deps.ffmpeg.minTimeoutMs);
  const audioPath = path.join(scratchDir, 'audio.wav');
  const extracted = await fromPromise(
    () =>
      deps.media.audio({
        ffmpegPath: deps.ffmpeg.path,
        limits: deps.ffmpeg.limits,
        timeoutMs,
        sourcePath: source.value,
        outputPath: audioPath,
        startMs: span.startMs,
        durationMs: span.durationMs,
        signal,
      }),
    (cause) => mediaFailureFrom('captions', cause)
  );
  if (isErr(extracted)) return extracted;

  const startedAt = deps.now();
  const transcript = await deps.speech.transcribe({
    whisperPath: deps.captions.whisperPath,
    modelPath: deps.captions.modelPath,
    vadModelPath: deps.captions.vadModelPath,
    threads: deps.captions.threads,
    inputPath: audioPath,
    outputBase: path.join(scratchDir, 'transcript'),
    language: job.language,
    timeoutMs,
    killGraceMs: deps.ffmpeg.limits.killGraceMs,
    stderrTailLines: deps.ffmpeg.limits.stderrTailLines,
    niceness: deps.captions.process.niceness,
    signal,
  });
  if (isOk(transcript)) {
    const elapsedMs = Math.max(1, deps.now() - startedAt);
    deps.metrics.captionsRealtimeFactor.observe(
      { model: deps.captions.modelVersion },
      span.durationMs / elapsedMs
    );
  }
  return transcript;
}
