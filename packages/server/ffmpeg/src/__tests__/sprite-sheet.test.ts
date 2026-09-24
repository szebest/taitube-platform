import { calculateSpriteGrid, generateSpriteVtt } from '../sprite-sheet';
import { SPRITE } from './encoder-settings';

describe('@vp/ffmpeg: sprite sheet (SDD §8.3)', () => {
  it.each([
    { durationMs: 0, frameCount: 1, rows: 1 },
    { durationMs: 60000, frameCount: 12, rows: 2 },
    { durationMs: 600000, frameCount: 120, rows: 12 },
  ])(
    'tiles a $durationMs ms source into $frameCount frames over $rows rows',
    ({ durationMs, frameCount, rows }) => {
      expect(calculateSpriteGrid(durationMs, SPRITE)).toMatchObject({
        frameCount,
        rows,
        columns: 10,
      });
    }
  );

  it.each([
    { durationMs: 5000, cue: '00:00:00.000 --> 00:00:05.000' },
    { durationMs: 65432, cue: '00:01:05.000 --> 00:01:05.432' },
    { durationMs: 3661005, cue: '01:01:00.000 --> 01:01:01.005' },
  ])('writes the last cue of a $durationMs ms source as $cue', ({ durationMs, cue }) => {
    const lines = generateSpriteVtt({ durationMs, layout: SPRITE }).trimEnd().split('\n');

    expect(lines.at(-2)).toBe(cue);
  });

  it.each([
    { durationMs: 60000, cueCount: 12 },
    { durationMs: 600000, cueCount: 120 },
  ])('writes $cueCount cues for a $durationMs ms source', ({ durationMs, cueCount }) => {
    const vtt = generateSpriteVtt({ durationMs, layout: SPRITE });
    const timings = vtt.split('\n').filter((line) => line.includes(' --> '));

    expect(timings).toHaveLength(cueCount);
  });

  it.each([
    { durationMs: 60000, cue: '00:00:00.000 --> 00:00:05.000\nsprite.jpg#xywh=0,0,160,90' },
    { durationMs: 60000, cue: '00:00:45.000 --> 00:00:50.000\nsprite.jpg#xywh=1440,0,160,90' },
    { durationMs: 60000, cue: '00:00:50.000 --> 00:00:55.000\nsprite.jpg#xywh=0,90,160,90' },
    { durationMs: 60000, cue: '00:00:55.000 --> 00:01:00.000\nsprite.jpg#xywh=160,90,160,90' },
    { durationMs: 600000, cue: '00:09:55.000 --> 00:10:00.000\nsprite.jpg#xywh=1440,990,160,90' },
  ])('writes the cue $cue for a $durationMs ms source', ({ durationMs, cue }) => {
    expect(generateSpriteVtt({ durationMs, layout: SPRITE })).toContain(cue);
  });
});
