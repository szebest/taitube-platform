import type { SavableRendition } from './lowest-rendition';

/** A master playlist naming one rendition, so a player offline never asks for one that was not saved. */
export function singleVariantMaster({
  playlistUrl,
  bandwidth,
  width,
  height,
}: SavableRendition): string {
  const resolution = width && height ? `,RESOLUTION=${width}x${height}` : '';
  return ['#EXTM3U', `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}${resolution}`, playlistUrl, ''].join(
    '\n'
  );
}
