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
