import { type CropRect, PLAYLIST_COVER_ASPECT } from '@vp/domain';

/** The largest 16:9 rectangle of whole pixels inside an image, centred on it. */
export function coverCrop({ width, height }: { width: number; height: number }): CropRect {
  const cropWidth = Math.min(width, Math.round(height * PLAYLIST_COVER_ASPECT));
  const cropHeight = Math.min(height, Math.round(cropWidth / PLAYLIST_COVER_ASPECT));

  return {
    x: Math.floor((width - cropWidth) / 2),
    y: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}
