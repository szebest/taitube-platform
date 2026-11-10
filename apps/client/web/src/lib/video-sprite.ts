import type { VideoSummary } from '@vp/api-contracts';
import type { VideoCardSprite } from '@vp/components';

/** The thumbnail sprite of a video as a card plays it, or nothing until the thumbnail stage has run. */
export function spriteOf({
  sprite,
  durationMs,
}: Pick<VideoSummary, 'sprite' | 'durationMs'>): VideoCardSprite | undefined {
  if (!sprite || durationMs === undefined) return undefined;

  return {
    url: sprite.url,
    columns: sprite.columns,
    tileWidth: sprite.tileWidth,
    tileHeight: sprite.tileHeight,
    intervalSec: sprite.intervalSec,
    count: Math.max(1, Math.ceil(durationMs / 1000 / sprite.intervalSec)),
  };
}
