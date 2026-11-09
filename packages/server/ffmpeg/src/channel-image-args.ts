import { CHANNEL_IMAGE_QUALITY } from '@vp/domain';
import type { ChannelImageVariant } from './channel-image-variants';

interface ChannelImageArgsOptions {
  sourcePath: string;
  outputPath: string;
  variant: Pick<ChannelImageVariant, 'crop' | 'width' | 'height'>;
}

/** Cuts the crop, scales it, drops every metadata tag (EXIF position included) and writes one WebP frame. */
export function buildChannelImageArgs({
  sourcePath,
  outputPath,
  variant: { crop, width, height },
}: ChannelImageArgsOptions): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-y',
    '-i',
    sourcePath,
    '-map',
    '0:v:0',
    '-map_metadata',
    '-1',
    '-an',
    '-sn',
    '-vf',
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${width}:${height}:flags=lanczos`,
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-quality',
    String(CHANNEL_IMAGE_QUALITY),
    outputPath,
  ];
}
