import type { MediaTools } from '@vp/ffmpeg';
import type { TranscodeJob } from '@vp/job-contracts';
import type { TranscodeProcessorDeps } from './transcode';

export interface EncodeRenditionParams {
  media: MediaTools;
  data: TranscodeJob;
  ffmpeg: TranscodeProcessorDeps['ffmpeg'];
  source: string;
  outputDir: string;
  chunkList: string | undefined;
  threads: number;
  attempt: number;
  signal: AbortSignal;
  onProgress: (progress: { percent: number }) => void;
}

/** One rendition's HLS from the source, or from its chunks and the source's audio. */
export async function encodeRendition(params: EncodeRenditionParams): Promise<void> {
  const { media, data, ffmpeg, source, outputDir, chunkList, threads, attempt } = params;
  const run = {
    ffmpegPath: ffmpeg.path,
    outputDir,
    rendition: data.rendition,
    hlsSegmentSeconds: ffmpeg.hlsSegmentSeconds,
    timeoutFactor: ffmpeg.timeoutFactor,
    minTimeoutMs: ffmpeg.minTimeoutMs,
    limits: ffmpeg.limits,
    durationMs: data.durationMs,
    threads,
    attempt,
    signal: params.signal,
    onProgress: params.onProgress,
  };

  if (chunkList) {
    await media.concat({ ...run, listPath: chunkList, audioSourcePath: source });
    return;
  }
  await media.transcode({
    ...run,
    sourcePath: source,
    fps: data.fps,
    gopSeconds: ffmpeg.gopSeconds,
    preset: ffmpeg.preset,
  });
}
