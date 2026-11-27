import { toSegmentRange } from '../segment-range';

describe('apps/client/web: toSegmentRange', () => {
  it.each([
    { bounds: 'no bounds', startMs: null, endMs: null, range: { kind: 'whole' } },
    { bounds: 'a start', startMs: 30_000, endMs: null, range: { kind: 'from', startMs: 30_000 } },
    {
      bounds: 'an end',
      startMs: null,
      endMs: 90_000,
      range: { kind: 'range', startMs: 0, endMs: 90_000 },
    },
    {
      bounds: 'both',
      startMs: 30_000,
      endMs: 90_000,
      range: { kind: 'range', startMs: 30_000, endMs: 90_000 },
    },
  ])('reads $bounds', ({ startMs, endMs, range }) => {
    expect(toSegmentRange(startMs, endMs)).toEqual(range);
  });
});
