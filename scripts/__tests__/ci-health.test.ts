import { countCauses, failedExecutions, measure, render } from '../ci-health';
import { job, prRun, run } from '../ci-health/__tests__/runs';

const WORKFLOW = 'jobs:\n  build:\n    timeout-minutes: 2\n';

describe('ci:health', () => {
  const runs = [
    prRun('a1', { 'unit-shard-2': 'failure' }, 1),
    prRun('a1', { 'unit-shard-2': 'success' }, 2),
    run({ conclusion: 'failure', jobs: [job('build', { conclusion: 'failure' })] }),
  ];

  it('lists each failed job once, with whether it later passed on the same commit', () => {
    expect(failedExecutions(runs).map(({ job: { name }, flipped }) => ({ name, flipped }))).toEqual(
      [
        { name: 'unit-shard-2', flipped: true },
        { name: 'build', flipped: false },
      ]
    );
  });

  it('counts the jobs and flips of each cause', () => {
    expect(
      countCauses([
        { cause: 'budget', flipped: true },
        { cause: 'budget', flipped: false },
        { cause: 'knip', flipped: false },
      ])
    ).toEqual([
      { cause: 'budget', jobs: 2, flipped: 1 },
      { cause: 'knip', jobs: 1, flipped: 0 },
    ]);
  });

  it('renders every table and the thresholds the window breaks', () => {
    const rendered = render(measure(runs, WORKFLOW), 'all, 3 runs');

    expect(rendered).toContain('# CI health, all, 3 runs');
    expect(rendered).toContain('## 4. Flips');
    expect(rendered).toContain('- main is green first time on 0.0% of runs, below 95.0%');
    expect(rendered).not.toContain('## 5. Merges');
  });
});
