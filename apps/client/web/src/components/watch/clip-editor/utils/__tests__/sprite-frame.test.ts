import { spriteFrameStyle } from '../sprite-frame';

const SPRITE = {
  url: 'http://localhost:9000/sprites/s.jpg',
  intervalSec: 10,
  columns: 5,
  tileWidth: 160,
  tileHeight: 90,
};

describe('apps/client/web: spriteFrameStyle', () => {
  it.each([
    {
      scenario: 'the first tile',
      durationSeconds: 100,
      seconds: 0,
      size: '500% 200%',
      position: '0% 0%',
    },
    {
      scenario: 'a tile in the first row',
      durationSeconds: 100,
      seconds: 35,
      size: '500% 200%',
      position: '75% 0%',
    },
    {
      scenario: 'a tile in the second row',
      durationSeconds: 100,
      seconds: 72,
      size: '500% 200%',
      position: '50% 100%',
    },
    {
      scenario: 'the last tile, for a time past the end',
      durationSeconds: 100,
      seconds: 400,
      size: '500% 200%',
      position: '100% 100%',
    },
    {
      scenario: 'a sheet shorter than a row',
      durationSeconds: 30,
      seconds: 25,
      size: '300% 100%',
      position: '100% 0%',
    },
    {
      scenario: 'a sheet of one tile',
      durationSeconds: 8,
      seconds: 3,
      size: '100% 100%',
      position: '0% 0%',
    },
  ])('shows $scenario', ({ durationSeconds, seconds, size, position }) => {
    expect(spriteFrameStyle(SPRITE, durationSeconds, seconds)).toMatchObject({
      backgroundSize: size,
      backgroundPosition: position,
    });
  });

  it('draws the sheet at the tile proportions', () => {
    expect(spriteFrameStyle(SPRITE, 100, 0)).toMatchObject({
      aspectRatio: '160 / 90',
      backgroundImage: 'url("http://localhost:9000/sprites/s.jpg")',
    });
  });
});
