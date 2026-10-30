import { initialClipRange } from '../clip-defaults';

describe('apps/client/web: initialClipRange', () => {
  it.each([
    {
      scenario: 'twenty seconds from the playhead',
      playhead: 75,
      durationMs: 120_000,
      range: { startMs: 75_000, endMs: 95_000 },
    },
    {
      scenario: 'from the start of the video',
      playhead: 0,
      durationMs: 120_000,
      range: { startMs: 0, endMs: 20_000 },
    },
    {
      scenario: 'a playhead with a fraction',
      playhead: 3.9,
      durationMs: 120_500,
      range: { startMs: 3000, endMs: 23_000 },
    },
    {
      scenario: 'pulled back near the end of the video',
      playhead: 110,
      durationMs: 120_000,
      range: { startMs: 100_000, endMs: 120_000 },
    },
    {
      scenario: 'a playhead past the end',
      playhead: 200,
      durationMs: 30_000,
      range: { startMs: 10_000, endMs: 30_000 },
    },
    {
      scenario: 'a video shorter than twenty seconds',
      playhead: 0,
      durationMs: 12_000,
      range: { startMs: 0, endMs: 12_000 },
    },
  ])('gives $scenario', ({ playhead, durationMs, range }) => {
    expect(initialClipRange(playhead, durationMs)).toEqual(range);
  });
});
