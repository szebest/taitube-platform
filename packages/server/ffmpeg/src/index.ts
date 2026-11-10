export * from './audio';
export * from './channel-image';
export * from './channel-image-args';
export * from './channel-image-probe';
export * from './channel-image-variants';
export * from './chunk';
export type { Fmp4Fragment } from './fmp4-fragments';
export * from './ladder';
export * from './live';
export * from './ll-hls-playlist';
export * from './master';
export * from './probe';
export type { ProbeMetadata } from './probe-metadata';
export * from './run-ffmpeg';
export type { SpriteLayout } from './sprite-sheet';
export * from './thumbnail';
export * from './transcode';
export { computeFfmpegThreads } from './transcode-args';

import { runFfmpegAudio } from './audio';
import { runFfmpegChannelImage } from './channel-image';
import { probeChannelImage } from './channel-image-probe';
import { runFfmpegChunk, runFfmpegConcat } from './chunk';
import { runFfmpegLive } from './live';
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
  probeChannelImage: typeof probeChannelImage;
  channelImage: typeof runFfmpegChannelImage;
  live: typeof runFfmpegLive;
}

export const mediaTools: MediaTools = {
  probe: runFfprobe,
  transcode: runFfmpegTranscode,
  transcodeChunk: runFfmpegChunk,
  concat: runFfmpegConcat,
  thumbnail: runFfmpegThumbnail,
  audio: runFfmpegAudio,
  probeChannelImage,
  channelImage: runFfmpegChannelImage,
  live: runFfmpegLive,
};
