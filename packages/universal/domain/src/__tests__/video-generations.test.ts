import { drifted, nextGeneration } from '../video-generations';

describe('@vp/domain: video generations', () => {
  it.each([
    { shape: 'no generation recorded', current: 1, known: [], next: 2 },
    {
      shape: 'a failed render past the active one',
      current: 2,
      known: [{ generation: 4 }],
      next: 5,
    },
    {
      shape: 'a reprocess past every recorded one',
      current: 6,
      known: [{ generation: 3 }],
      next: 7,
    },
  ])('numbers the next render one past $shape', ({ current, known, next }) => {
    expect(nextGeneration(current, known)).toBe(next);
  });

  it.each([
    { before: null, after: 90_000, flagged: false },
    { before: 90_000, after: 92_000, flagged: false },
    { before: 90_000, after: 92_001, flagged: true },
    { before: 90_000, after: 60_000, flagged: true },
  ])('a move from $before to $after ms drifts: $flagged', ({ before, after, flagged }) => {
    expect(drifted(before, after)).toBe(flagged);
  });
});
