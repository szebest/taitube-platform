import {
  buildChunkArgs,
  buildConcatArgs,
  type ChunkArgsOptions,
  type ConcatArgsOptions,
} from './chunk-args';
import type { FfmpegProcessLimits } from './run-ffmpeg';
import { runFfmpeg } from './run-ffmpeg';
import { progressLineHandler, type TranscodeOptions } from './transcode';

interface RunOptions {
  ffmpegPath: string;
  durationMs: number;
  timeoutFactor: number;
  minTimeoutMs: number;
  limits: FfmpegProcessLimits;
  onProgress?: TranscodeOptions['onProgress'];
  signal?: AbortSignal;
}

export type ChunkOptions = ChunkArgsOptions & RunOptions;
export type ConcatOptions = ConcatArgsOptions & RunOptions;

export async function runFfmpegChunk(options: ChunkOptions): Promise<void> {
  await runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'transcode-chunk',
    args: buildChunkArgs(options),
    timeoutMs: Math.max(options.timeoutFactor * options.durationMs, options.minTimeoutMs),
    attributes: { 'ffmpeg.rendition': options.rendition.name, rendition: options.rendition.name },
    onStdoutLine: progressLineHandler(options.durationMs, options.onProgress),
  });
}

export async function runFfmpegConcat(options: ConcatOptions): Promise<void> {
  await runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'concat',
    args: buildConcatArgs(options),
    timeoutMs: Math.max(options.timeoutFactor * options.durationMs, options.minTimeoutMs),
    attributes: { 'ffmpeg.rendition': options.rendition.name, rendition: options.rendition.name },
    onStdoutLine: progressLineHandler(options.durationMs, options.onProgress),
  });
}
