import { spriteOf } from '../video-sprite';

const SPRITE = { url: '/s.jpg', intervalSec: 5, columns: 10, tileWidth: 160, tileHeight: 90 };

describe('apps/client/web: spriteOf', () => {
  it.each([
    { label: 'a sheet every 5 seconds over 62 seconds', durationMs: 62_000, count: 13 },
    { label: 'a clip shorter than one interval', durationMs: 1_000, count: 1 },
    { label: 'a clip of no length', durationMs: 0, count: 1 },
  ])('counts the tiles of $label', ({ durationMs, count }) => {
    expect(spriteOf({ sprite: SPRITE, durationMs })).toEqual({ ...SPRITE, count });
  });

  it.each([
    { label: 'no sprite yet', video: { durationMs: 10_000 } },
    { label: 'no duration', video: { sprite: SPRITE } },
  ])('offers nothing for $label', ({ video }) => {
    expect(spriteOf(video)).toBeUndefined();
  });
});
