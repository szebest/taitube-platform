import type { CSSProperties } from 'react';
import type { ClipEditorSprite } from './types';

function percentAlong(index: number, count: number): number {
  return count > 1 ? (index / (count - 1)) * 100 : 0;
}

/** The style that shows the sprite tile holding `seconds` in an element as wide as one tile. */
export function spriteFrameStyle(
  sprite: ClipEditorSprite,
  durationSeconds: number,
  seconds: number
): CSSProperties {
  const tiles = Math.max(Math.ceil(durationSeconds / sprite.intervalSec), 1);
  const index = Math.min(Math.floor(seconds / sprite.intervalSec), tiles - 1);
  const rows = Math.ceil(tiles / sprite.columns);
  const columns = Math.min(sprite.columns, tiles);

  return {
    aspectRatio: `${sprite.tileWidth} / ${sprite.tileHeight}`,
    backgroundImage: `url("${sprite.url}")`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${percentAlong(index % sprite.columns, columns)}% ${percentAlong(Math.floor(index / sprite.columns), rows)}%`,
  };
}
