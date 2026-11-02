import { flipRate, flips, renderFlips } from '../flips';
import type { Run } from '../model';
import { prRun } from './runs';

const twice = (
  sha: string,
  first: Record<string, string>,
  second: Record<string, string>
): Run[] => [prRun(sha, first, 1), prRun(sha, second, 2)];

describe('flips', () => {
  const result = flips([
    ...twice(
      'a1',
      { 'unit-shard-2': 'failure', unit: 'failure' },
      { 'unit-shard-2': 'success', unit: 'success' }
    ),
    ...twice('b2', { 'visual-7': 'failure' }, { 'visual-7': 'failure' }),
    prRun('c3', { 'e2e-web': 'success' }),
    { ...prRun('d4', { 'e2e-web': 'success' }), retried: [{ job: 'e2e-web', test: 'shorts' }] },
  ]);

  it('counts a job that failed and later passed on the same commit, the aggregates apart', () => {
    expect(result.byJob).toEqual([
      { job: 'unit-shard', flips: 1 },
      { job: 'unit', flips: 1 },
    ]);
    expect(result.rootFlips).toBe(1);
  });

  it('rates the commits with a root flip or a pass on retry over the conclusive commits', () => {
    expect(result).toMatchObject({ flippedCommits: 2, conclusiveCommits: 4, reruns: 2, runs: 6 });
    expect(flipRate(result)).toBe(0.5);
  });

  it('renders the rate and a row per job', () => {
    const rendered = renderFlips(result);

    expect(rendered).toContain(
      '2 of 4, 50.0% of the conclusive commits had a root flip or a pass on retry'
    );
    expect(rendered).toContain('| unit | 1 | repeats a shard |');
  });
});
