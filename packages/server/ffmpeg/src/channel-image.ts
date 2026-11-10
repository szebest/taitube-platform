import * as path from 'node:path';
import { buildChannelImageArgs } from './channel-image-args';
import type { ChannelImageVariant } from './channel-image-variants';
import { type FfmpegProcessLimits, runFfmpeg } from './run-ffmpeg';

export interface RunChannelImageOptions {
  ffmpegPath: string;
  sourcePath: string;
  outputDir: string;
  variants: readonly ChannelImageVariant[];
  timeoutMs: number;
  limits: FfmpegProcessLimits;
}

export interface ChannelImageFile {
  name: string;
  path: string;
}

/** Cuts every variant of one source into `outputDir`, one process at a time to keep memory flat. */
export async function runFfmpegChannelImage(
  options: RunChannelImageOptions
): Promise<ChannelImageFile[]> {
  const { ffmpegPath, sourcePath, outputDir, variants, timeoutMs, limits } = options;
  const files: ChannelImageFile[] = [];

  for (const variant of variants) {
    const outputPath = path.join(outputDir, `${variant.name}.webp`);
    await runFfmpeg({
      ffmpegPath,
      stage: 'channel-image',
      args: buildChannelImageArgs({ sourcePath, outputPath, variant }),
      timeoutMs,
      limits,
    });
    files.push({ name: variant.name, path: outputPath });
  }
  return files;
}
