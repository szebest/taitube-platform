import { type FfmpegProcessLimits, runFfmpeg } from '@vp/ffmpeg';
import { type FrameSample, sampleFrame, splitFrames } from './frame-hash';
import { buildFrameSamplingArgs } from './frame-sampling-args';

export interface SampleFramesOptions {
  ffmpegPath: string;
  sourcePath: string;
  intervalSeconds: number;
  timeoutMs: number;
  limits: FfmpegProcessLimits;
  signal?: AbortSignal;
}

/** The hash, mirrored hash and brightness of a frame every `intervalSeconds`, in playback order. */
export async function sampleFrames(options: SampleFramesOptions): Promise<FrameSample[]> {
  const chunks: Uint8Array[] = [];
  await runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'screen-frames',
    args: buildFrameSamplingArgs(options),
    timeoutMs: options.timeoutMs,
    stdout: { type: 'bytes', onChunk: (chunk) => chunks.push(Uint8Array.from(chunk)) },
  });
  return splitFrames(Buffer.concat(chunks)).map(sampleFrame);
}
