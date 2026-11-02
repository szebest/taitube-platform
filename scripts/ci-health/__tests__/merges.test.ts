import { renderMerges, trace, tracedToMerge } from '../merges';
import type { Merge } from '../model';

const merge = (overrides: Partial<Merge> = {}): Merge => ({
  sha: '3ead86a6f00d',
  pr: 277,
  behindBy: 0,
  lastPrRun: 'success',
  mainRun: 'success',
  ...overrides,
});

describe('trace', () => {
  it.each([
    { overrides: {}, expected: 'green', traced: false },
    { overrides: { mainRun: 'cancelled' }, expected: 'not checked', traced: false },
    { overrides: { mainRun: 'none' }, expected: 'not checked', traced: false },
    {
      overrides: { mainRun: 'failure', lastPrRun: 'failure' },
      expected: 'inherited from a red PR',
      traced: true,
    },
    {
      overrides: { mainRun: 'failure', behindBy: 1 },
      expected: 'landed behind main',
      traced: true,
    },
    { overrides: { mainRun: 'failure' }, expected: 'main only', traced: false },
  ] as const)('reads $overrides as $expected', ({ overrides, expected, traced }) => {
    expect(trace(merge(overrides))).toBe(expected);
    expect(tracedToMerge(merge(overrides))).toBe(traced);
  });
});

describe('renderMerges', () => {
  it('sums the merges behind main, merged red and traced, then lists each', () => {
    const rendered = renderMerges([
      merge({ mainRun: 'failure', behindBy: 1 }),
      merge({ pr: 275, lastPrRun: 'failure' }),
    ]);

    expect(rendered).toContain(
      'Of the last 2 merges: 1 of 2, 50.0% landed behind main, 1 of 2, 50.0% with a last PR run that was not green, 1 main failures traced to a merge.'
    );
    expect(rendered).toContain('| #277 | 3ead86a6 | 1 | success | failure | landed behind main |');
  });
});
