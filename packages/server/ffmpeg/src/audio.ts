import { type FfmpegProcessLimits, runFfmpeg } from './run-ffmpeg';

export interface AudioArgsOptions {
  sourcePath: string;
  outputPath: string;
  startMs: number;
  durationMs: number;
}

/**
 * Mono 16 kHz PCM, what whisper.cpp reads. The seek sits before `-i` so a presigned source is
 * range-read from the window's start instead of decoded from zero.
 */
export function buildAudioArgs(options: AudioArgsOptions): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    String(options.startMs / 1000),
    '-t',
    String(options.durationMs / 1000),
    '-i',
    options.sourcePath,
    '-map',
    '0:a:0',
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    options.outputPath,
  ];
}

export interface AudioOptions extends AudioArgsOptions {
  ffmpegPath: string;
  limits: FfmpegProcessLimits;
  timeoutMs: number;
  signal?: AbortSignal;
}

export async function runFfmpegAudio(options: AudioOptions): Promise<void> {
  await runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'captions',
    args: buildAudioArgs(options),
    timeoutMs: options.timeoutMs,
  });
}
