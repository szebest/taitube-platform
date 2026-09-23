export * from './ladder';
export * from './master';
export * from './probe';
export * from './run-ffmpeg';
export * from './transcode';
export * from './thumbnail';

import { runFfprobe } from './probe';
import { runFfmpegThumbnail } from './thumbnail';
import { runFfmpegTranscode } from './transcode';

/**
 * The processes a stage spawns, as one value the composition root hands it. A spec fails a stage by
 * handing it a double of this, not by spying on the module.
 */
export interface MediaTools {
  probe: typeof runFfprobe;
  transcode: typeof runFfmpegTranscode;
  thumbnail: typeof runFfmpegThumbnail;
}

export const mediaTools: MediaTools = {
  probe: runFfprobe,
  transcode: runFfmpegTranscode,
  thumbnail: runFfmpegThumbnail,
};

export interface FfmpegLadderSpec {
  name: '1080p' | '720p' | '480p';
  width: number;
  height: number;
  videoKbps: number;
  audioKbps: number;
}

export const DEFAULT_LADDER: readonly FfmpegLadderSpec[] = [
  { name: '1080p', width: 1920, height: 1080, videoKbps: 5000, audioKbps: 128 },
  { name: '720p', width: 1280, height: 720, videoKbps: 2800, audioKbps: 128 },
  { name: '480p', width: 854, height: 480, videoKbps: 1400, audioKbps: 96 },
] as const;
