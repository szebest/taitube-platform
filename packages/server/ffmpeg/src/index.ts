export * from './audio';
export * from './chunk';
export * from './ladder';
export * from './master';
export * from './probe';
export type { ProbeMetadata } from './probe-metadata';
export * from './run-ffmpeg';
export type { SpriteLayout } from './sprite-sheet';
export * from './thumbnail';
export * from './transcode';
export { computeFfmpegThreads } from './transcode-args';

import { runFfmpegAudio } from './audio';
import { runFfmpegChunk, runFfmpegConcat } from './chunk';
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
  transcodeChunk: typeof runFfmpegChunk;
  concat: typeof runFfmpegConcat;
  thumbnail: typeof runFfmpegThumbnail;
  audio: typeof runFfmpegAudio;
}

export const mediaTools: MediaTools = {
  probe: runFfprobe,
  transcode: runFfmpegTranscode,
  transcodeChunk: runFfmpegChunk,
  concat: runFfmpegConcat,
  thumbnail: runFfmpegThumbnail,
  audio: runFfmpegAudio,
};
