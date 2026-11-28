# SpriteStrip

Frames of a video side by side along its length, from its thumbnail sprite sheet: the picture under a range control, so a creator can see what a position holds. It is decoration (`aria-hidden`) and carries no copy. In `@kit/components` because web's clip editor and `TimelineRangeEditor` both draw it ([116](../../tickets/116-video-management-power-tools.md)).

## Props

```ts
interface SpriteStripProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  sprite: SpriteSheet;      // url, intervalSec, columns, tileWidth, tileHeight
  durationMs: number;
  frames?: number;          // default 8, evenly spaced
  shade?: { startMs: number; endMs: number }; // everything outside it is dimmed
}
```

Each frame shows the sprite tile holding the middle of its slice of the video (`spriteFrameStyle`). `shade` lays two `bg-scrim` panes at the inline start and end, so a right-to-left page mirrors them. A control sits over the strip; the strip itself takes no input.

## Accessibility

`aria-hidden="true"`: the control above it names every value in words.
