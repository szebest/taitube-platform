import type { FirstTimeRow } from '../first-time';
import type { Flips } from '../flips';
import type { MarginRow } from '../margins';
import { breaches, type Measured } from '../thresholds';

const main = (green: number): FirstTimeRow => ({
  branch: 'main (push)',
  runs: 20,
  cancelled: 0,
  conclusive: 20,
  green,
  requiredGreen: 20,
});

const flipped = (flippedCommits: number): Flips => ({
  byJob: [],
  rootFlips: flippedCommits,
  flippedCommits,
  conclusiveCommits: 100,
  reruns: 0,
  runs: 100,
});

const margin = (near85: number): MarginRow => ({
  label: 'integration',
  seconds: 300,
  median: 130,
  p90: 150,
  max: 260,
  runs: 50,
  near85,
  near90: 0,
  over: 0,
});

const measured = (overrides: Partial<Measured> = {}): Measured => ({
  firstTime: [main(19)],
  flips: flipped(1),
  margins: [margin(0)],
  ...overrides,
});

describe('breaches', () => {
  it('passes a healthy window', () => {
    expect(breaches(measured())).toEqual([]);
  });

  it.each([
    {
      overrides: { firstTime: [main(18)] },
      expected: 'main is green first time on 90.0% of runs, below 95.0%',
    },
    {
      overrides: { flips: flipped(2) },
      expected: '2.0% of commits had a root flip, at or above 2.0%',
    },
    {
      overrides: { margins: [margin(1)] },
      expected: 'integration: 1 of 50 runs within 15.0% of its 300 s limit, the slowest 260 s',
    },
  ])('names the breach: $expected', ({ overrides, expected }) => {
    expect(breaches(measured(overrides))).toEqual([expected]);
  });

  it('judges no green rate on a window without main runs', () => {
    expect(breaches(measured({ firstTime: [{ ...main(0), branch: 'PRs' }] }))).toEqual([]);
  });
});
