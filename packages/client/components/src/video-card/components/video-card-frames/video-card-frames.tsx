import { useEffect, useState } from 'react';

const FRAME_MS = 250;

const percent = (value: number) => `${Math.round(value * 1000) / 1000}%`;

/** A sprite sheet: `count` tiles of `tileWidth` by `tileHeight`, `columns` to a row, `intervalSec` of video apart. */
export interface VideoCardSprite {
  url: string;
  columns: number;
  count: number;
  tileWidth: number;
  tileHeight: number;
  intervalSec: number;
}

export interface VideoCardFramesProps {
  sprite: VideoCardSprite;
  className?: string;
}

/**
 * The sprite sheet's frames, four a second, in the thumbnail's box: the sheet is one image under an
 * `overflow: hidden` frame and a `translate` steps it, so nothing but the compositor works and the
 * card's box never changes. `dir="ltr"` keeps the sheet's origin at the left in a right-to-left page.
 */
export function VideoCardFrames({ sprite, className }: VideoCardFramesProps) {
  const [frame, setFrame] = useState(0);
  const { columns, count, url } = sprite;

  useEffect(() => {
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % count), FRAME_MS);
    return () => window.clearInterval(timer);
  }, [count]);

  const rows = Math.ceil(count / columns);
  const column = frame % columns;
  const row = Math.floor(frame / columns);

  return (
    <div dir="ltr" data-slot="video-card-frames" aria-hidden="true" className={className}>
      <img
        src={url}
        alt=""
        draggable={false}
        className="absolute start-0 top-0 max-w-none will-change-transform"
        style={{
          width: `${columns * 100}%`,
          translate: `${percent((-column * 100) / columns)} ${percent((-row * 100) / rows)}`,
        }}
      />
    </div>
  );
}
