/** A sprite sheet: tiles of `tileWidth` by `tileHeight`, `columns` to a row, `intervalSec` of video apart. */
export interface SpriteSheet {
  url: string;
  intervalSec: number;
  columns: number;
  tileWidth: number;
  tileHeight: number;
}

/** The part of a video's length the strip leaves unshaded. */
export interface SpriteStripShade {
  startMs: number;
  endMs: number;
}
