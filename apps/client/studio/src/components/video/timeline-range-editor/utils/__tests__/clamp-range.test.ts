import { clampRange } from '../clamp-range';

const WIDE = { startMs: 10_000, endMs: 40_000 };

describe('apps/client/studio: clampRange', () => {
  it.each([
    {
      name: 'a range inside the limit',
      previous: { startMs: 10_000, endMs: 20_000 },
      next: [12, 22],
      expected: { startMs: 12_000, endMs: 22_000 },
    },
    {
      name: 'a start dragged back past the limit, which pulls the end with it',
      previous: WIDE,
      next: [8, 40],
      expected: { startMs: 8_000, endMs: 38_000 },
    },
    {
      name: 'an end dragged out past the limit, which pulls the start with it',
      previous: WIDE,
      next: [10, 41],
      expected: { startMs: 11_000, endMs: 41_000 },
    },
  ])('answers $name', ({ previous, next, expected }) => {
    expect(clampRange(previous, next, 30_000)).toEqual(expected);
  });
});
