import { assertNever } from '@kit/result';
import type { PlaylistView } from '@vp/api-contracts';

/** The pictures a playlist's cover draws: the mosaic the API picked, or the one image its mode names. */
export function coverImages({ cover, thumbnailUrl }: PlaylistView): string[] {
  switch (cover.mode) {
    case 'auto':
      return cover.mosaicUrls;
    case 'item':
    case 'custom':
      return thumbnailUrl === null ? [] : [thumbnailUrl];
    default:
      return assertNever(cover.mode, 'PlaylistCoverMode');
  }
}
