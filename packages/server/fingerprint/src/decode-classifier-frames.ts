import type { RgbFrame } from '@vp/core/ports';
import { type FfmpegProcessLimits, runFfmpeg } from '@vp/ffmpeg';

const CHANNELS = 3;

export interface ClassifierFrame {
  timestampSeconds: number;
  frame: RgbFrame;
}

export interface DecodeClassifierFramesOptions {
  ffmpegPath: string;
  sourcePath: string;
  timestampsSeconds: readonly number[];
  /** The side of the square frame the classifier takes. */
  size: number;
  /** Frames decoded at once; each is its own single-threaded ffmpeg. */
  concurrency: number;
  timeoutMs: number;
  limits: FfmpegProcessLimits;
  signal?: AbortSignal;
}

/**
 * One frame as raw RGB, squashed to `size` by `size` the way the classifier's own preprocessing does.
 * `-ss` before `-i` seeks to the nearest keyframe first, so a frame costs a short decode, not a pass
 * over the video.
 */
function buildClassifierFrameArgs(options: {
  sourcePath: string;
  timestampSeconds: number;
  size: number;
}): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-threads',
    '1',
    '-ss',
    String(options.timestampSeconds),
    '-i',
    options.sourcePath,
    '-an',
    '-sn',
    '-frames:v',
    '1',
    '-vf',
    `scale=${options.size}:${options.size}:flags=bilinear`,
    '-pix_fmt',
    'rgb24',
    '-f',
    'rawvideo',
    'pipe:1',
  ];
}

async function decodeFrame(
  options: DecodeClassifierFramesOptions,
  timestampSeconds: number
): Promise<ClassifierFrame | null> {
  const chunks: Uint8Array[] = [];
  await runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'screen-classify',
    args: buildClassifierFrameArgs({
      sourcePath: options.sourcePath,
      timestampSeconds,
      size: options.size,
    }),
    timeoutMs: options.timeoutMs,
    stdout: { type: 'bytes', onChunk: (chunk) => chunks.push(Uint8Array.from(chunk)) },
  });
  const data = Buffer.concat(chunks);
  if (data.length !== options.size * options.size * CHANNELS) return null;
  return { timestampSeconds, frame: { width: options.size, height: options.size, data } };
}

/**
 * The frames at the given moments, in order. A moment past the last decodable frame yields nothing and
 * is left out, so a source whose duration is a little over what it holds scores the frames it has.
 */
export async function sampleClassifierFrames(
  options: DecodeClassifierFramesOptions
): Promise<ClassifierFrame[]> {
  const frames: (ClassifierFrame | null)[] = [];
  for (let from = 0; from < options.timestampsSeconds.length; from += options.concurrency) {
    const batch = options.timestampsSeconds.slice(from, from + options.concurrency);
    frames.push(...(await Promise.all(batch.map((moment) => decodeFrame(options, moment)))));
  }
  return frames.filter((frame): frame is ClassifierFrame => frame !== null);
}
