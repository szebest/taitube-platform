import * as path from 'node:path';
import { MICROSECONDS_PER_MS } from '@vp/domain/time';
import type { LadderEntry } from '@vp/job-contracts';
import { type FfmpegProcessLimits, runFfmpeg } from './run-ffmpeg';

export interface TranscodeOptions {
  ffmpegPath: string;
  sourcePath: string;
  outputDir: string;
  rendition: LadderEntry;
  fps: number;
  gopSeconds: number;
  hlsSegmentSeconds: number;
  durationMs: number;
  threads: number;
  attempt?: number;
  preset: string;
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

/**
 * Computes the number of threads for FFmpeg based on base threads and retry attempt (SDD §9.6 rule 6, Ticket 14 AC 3).
 * Attempt 1: FFMPEG_THREADS
 * Attempt 2: FFMPEG_THREADS - 1
 * Attempt >= FFMPEG_THREADS: 1
 */
export function computeFfmpegThreads(baseThreads: number, attempt = 1): number {
  const effectiveBase = baseThreads > 0 ? baseThreads : 2;
  const computed = effectiveBase - (attempt - 1);
  return Math.max(1, computed);
}

/**
 * Builds the exact FFmpeg argument array according to SDD §8.2.
 */
export function buildTranscodeArgs(options: TranscodeOptions): string[] {
  const { sourcePath, outputDir, rendition, fps, preset, gopSeconds, hlsSegmentSeconds } = options;

  const threads =
    options.attempt !== undefined
      ? computeFfmpegThreads(options.threads, options.attempt)
      : options.threads;

  const gop = Math.max(1, Math.round(gopSeconds * fps));
  const segmentFilename = path.join(outputDir, 'seg_%05d.ts');
  const playlistFilename = path.join(outputDir, 'index.m3u8');

  const args: string[] = [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    '-i',
    sourcePath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    `scale=w=${rendition.width}:h=${rendition.height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    '-c:v',
    'libx264',
    '-fps_mode',
    'cfr',
    '-preset',
    preset,
    '-profile:v',
    rendition.profile,
    '-level',
    rendition.level,
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    `${rendition.videoKbps}k`,
    '-maxrate',
    `${rendition.maxrateKbps}k`,
    '-bufsize',
    `${rendition.bufsizeKbps}k`,
    '-g',
    String(gop),
    '-keyint_min',
    String(gop),
    '-sc_threshold',
    '0',
    '-force_key_frames',
    `expr:gte(t,n_forced*${gopSeconds})`,
    '-c:a',
    'aac',
    '-b:a',
    `${rendition.audioKbps}k`,
    '-ac',
    '2',
    '-ar',
    '48000',
    '-f',
    'hls',
    '-hls_time',
    String(hlsSegmentSeconds),
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments+temp_file',
    '-hls_segment_type',
    'mpegts',
    '-hls_segment_filename',
    segmentFilename,
  ];

  if (threads > 0) {
    args.push('-threads', String(threads));
  }

  args.push(playlistFilename);
  return args;
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
