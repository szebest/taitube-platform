import * as path from 'node:path';
import type { LadderEntry } from '@vp/job-contracts';

export interface TranscodeArgsOptions {
  sourcePath: string;
  outputDir: string;
  rendition: LadderEntry;
  fps: number;
  gopSeconds: number;
  hlsSegmentSeconds: number;
  threads: number;
  attempt?: number;
  preset: string;
}

/**
 * Threads for an FFmpeg attempt, one fewer per retry (SDD §9.6 rule 6).
 * Attempt 1: FFMPEG_THREADS
 * Attempt 2: FFMPEG_THREADS - 1
 * Attempt >= FFMPEG_THREADS: 1
 */
export function computeFfmpegThreads(baseThreads: number, attempt = 1): number {
  const effectiveBase = baseThreads > 0 ? baseThreads : 2;
  const computed = effectiveBase - (attempt - 1);
  return Math.max(1, computed);
}

type VideoEncodeOptions = Pick<TranscodeArgsOptions, 'rendition' | 'fps' | 'gopSeconds' | 'preset'>;

export function videoEncodeArgs(options: VideoEncodeOptions): string[] {
  const { rendition, fps, preset, gopSeconds } = options;
  const gop = Math.max(1, Math.round(gopSeconds * fps));

  return [
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
  ];
}

export function audioEncodeArgs(rendition: LadderEntry): string[] {
  return ['-c:a', 'aac', '-b:a', `${rendition.audioKbps}k`, '-ac', '2', '-ar', '48000'];
}

export function hlsOutputArgs(outputDir: string, hlsSegmentSeconds: number): string[] {
  return [
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
    path.join(outputDir, 'seg_%05d.ts'),
  ];
}

export function resolveThreads(options: Pick<TranscodeArgsOptions, 'threads' | 'attempt'>): number {
  return options.attempt !== undefined
    ? computeFfmpegThreads(options.threads, options.attempt)
    : options.threads;
}

export function buildTranscodeArgs(options: TranscodeArgsOptions): string[] {
  const { sourcePath, outputDir, rendition, hlsSegmentSeconds } = options;
  const threads = resolveThreads(options);

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
    ...videoEncodeArgs(options),
    ...audioEncodeArgs(rendition),
    ...hlsOutputArgs(outputDir, hlsSegmentSeconds),
  ];

  if (threads > 0) {
    args.push('-threads', String(threads));
  }

  args.push(path.join(outputDir, 'index.m3u8'));
  return args;
}
