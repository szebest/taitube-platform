import type { CaptionRecord } from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import { type CaptionsJob, captionsFlow } from '@vp/job-contracts';
import { createMetricsRegistry } from '@vp/observability';
import { ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import type { SpeechTools } from '@vp/whisper';
import { uuidv7 } from 'uuidv7';
import { type FlowWorld, flowWorld, uploadedVideo } from '../../../__tests__/flow-harness';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import type { CaptionsStageDeps } from '../captions-deps';

export const CUE_EVERY_MS = 10_000;

/** ffmpeg that records which span of audio each window asked for, and fails on a silent source. */
function fakeAudio(spans: { startMs: number; durationMs: number }[], silent: boolean) {
  return async (options: Parameters<MediaTools['audio']>[0]) => {
    if (silent) throw new PermanentError(ErrorCodes.NO_AUDIO_STREAM, 'no audio');
    spans.push({ startMs: options.startMs, durationMs: options.durationMs });
  };
}

/**
 * whisper that hears one cue every ten seconds of the media timeline, so a long source split into
 * windows and the same source in one run must yield the same cues.
 */
function fakeSpeech(
  spans: { startMs: number; durationMs: number }[],
  language: string
): SpeechTools {
  return {
    transcribe: async () => {
      const span = spans.at(-1) ?? { startMs: 0, durationMs: 0 };
      const first = Math.ceil(span.startMs / CUE_EVERY_MS) * CUE_EVERY_MS;
      const cues = [];
      for (let at = first; at < span.startMs + span.durationMs; at += CUE_EVERY_MS) {
        cues.push({
          startMs: at - span.startMs,
          endMs: at - span.startMs + 2000,
          text: `at ${at}`,
        });
      }
      return ok({ language, cues });
    },
  };
}

export interface CaptionsWorld extends FlowWorld {
  deps: CaptionsStageDeps;
  spans: { startMs: number; durationMs: number }[];
  videoId: string;
  track: CaptionRecord;
  job: (plan: CaptionsJob['plan']) => { id: string; name: string; data: CaptionsJob };
  run: () => ReturnType<typeof captionsFlow>;
}

export async function captionsWorld(
  options: { durationMs?: number; language?: string; silent?: boolean; hint?: string } = {}
): Promise<CaptionsWorld> {
  const world = flowWorld();
  const spans: { startMs: number; durationMs: number }[] = [];
  const sourceKey = `raw/${uuidv7()}/source.mp4`;
  const videoId = await uploadedVideo(world, sourceKey);
  const track = expectOk(
    await world.repositories.captions.createGenerated({
      id: uuidv7(),
      videoId,
      language: options.hint ?? null,
      modelVersion: 'small-q5_1',
      status: 'pending',
      reason: null,
    })
  );
  const deps: CaptionsStageDeps = {
    ...STAGE_SETTINGS,
    repositories: world.repositories,
    storage: world.storage,
    logger: world.logger,
    metrics: createMetricsRegistry(),
    media: { ...STAGE_SETTINGS.media, audio: fakeAudio(spans, options.silent ?? false) },
    speech: fakeSpeech(spans, options.language ?? 'en'),
    ffmpeg: {
      path: 'ffmpeg',
      limits: STAGE_SETTINGS.ffmpegProcess,
      timeoutFactor: 3,
      minTimeoutMs: 60_000,
    },
    captions: STAGE_SETTINGS.captions,
  };
  const run = () =>
    captionsFlow({
      videoId,
      captionId: track.id,
      captionVersion: track.version,
      sourceKey,
      durationMs: options.durationMs ?? 60_000,
      modelVersion: 'small-q5_1',
      language: options.hint ?? null,
      traceparent: '',
    });
  const job = (plan: CaptionsJob['plan']) => ({
    id: `${videoId}--${plan.type}`,
    name: 'captions',
    data: { ...run().data, plan },
  });
  return { ...world, deps, spans, videoId, track, job, run };
}
