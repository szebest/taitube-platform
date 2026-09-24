import * as path from 'node:path';
import { MICROSECONDS_PER_MS } from '@vp/domain/time';
import { type FfmpegProcessLimits, runFfmpeg } from './run-ffmpeg';
import { type TranscodeArgsOptions, buildTranscodeArgs } from './transcode-args';

export interface TranscodeOptions extends TranscodeArgsOptions {
  ffmpegPath: string;
  durationMs: number;
  timeoutFactor: number;
  minTimeoutMs: number;
  limits: FfmpegProcessLimits;
  onProgress?: (progress: { percent: number; outTimeMs: number }) => void;
  /** Aborting stops the encode the way the hard timeout does: SIGTERM, then SIGKILL after the grace. */
  signal?: AbortSignal;
}

export interface TranscodeExecutionResult {
  outputDir: string;
  playlistPath: string;
  segmentCount: number;
  durationMs: number;
}

/** ffmpeg reports both of these in microseconds, whatever the suffix says. */
const PROGRESS_TIME_KEYS = ['out_time_ms=', 'out_time_us='] as const;

/**
 * Runs FFmpeg to transcode one rendition to HLS TS segments with progress and error classification.
 */
export async function runFfmpegTranscode(
  options: TranscodeOptions
): Promise<TranscodeExecutionResult> {
  const { durationMs } = options;
  const timeoutMs = Math.max(options.timeoutFactor * durationMs, options.minTimeoutMs);

  await runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'transcode',
    args: buildTranscodeArgs(options),
    timeoutMs,
    attributes: {
      'ffmpeg.rendition': options.rendition.name,
      rendition: options.rendition.name,
    },
    onStdoutLine: (line) => {
      const prefix = PROGRESS_TIME_KEYS.find((key) => line.startsWith(key));
      if (!prefix) return;
      const microseconds = Number.parseInt(line.slice(prefix.length), 10);
      if (Number.isNaN(microseconds) || microseconds <= 0) return;
      const outTimeMs = Math.round(microseconds / MICROSECONDS_PER_MS);
      options.onProgress?.({
        percent: Math.min(100, Math.round((outTimeMs / durationMs) * 100)),
        outTimeMs,
      });
    },
  });

  return {
    outputDir: options.outputDir,
    playlistPath: path.join(options.outputDir, 'index.m3u8'),
    segmentCount: 0,
    durationMs,
  };
}
