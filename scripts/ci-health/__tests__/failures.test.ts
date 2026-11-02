import { failures, jobGroup, renderFailures } from '../failures';
import { prRun } from './runs';

describe('jobGroup', () => {
  it.each([
    ['visual-10', 'visual'],
    ['unit-shard-3', 'unit-shard'],
    ['e2e-web', 'e2e-web'],
    ['lint-typecheck', 'lint-typecheck'],
  ])('groups %s under %s', (name, group) => {
    expect(jobGroup(name)).toBe(group);
  });
});

describe('failures', () => {
  const result = failures([
    prRun('a1', {
      'visual-1': 'failure',
      'visual-7': 'failure',
      'unit-shard-2': 'failure',
      unit: 'failure',
    }),
    prRun('b2', { 'visual-7': 'failure', 'e2e-web': 'success' }),
    prRun('c3', { 'e2e-web': 'success' }),
  ]);

  it('counts failed job rows and the runs that hold them, over red first attempts only', () => {
    expect(result.failedRuns).toBe(2);
    expect(result.rows).toContainEqual({ job: 'visual', rows: 3, runs: 2, aggregate: false });
  });

  it('leaves the aggregates out of the root rows and lists them last', () => {
    expect(result.rootRows).toBe(4);
    expect(result.rows.at(-1)).toEqual({ job: 'unit', rows: 1, runs: 1, aggregate: true });
  });

  it('renders the share of the root rows', () => {
    const rendered = renderFailures(result);

    expect(rendered).toContain('| visual | 3 | 75.0% | 2 (100.0%) |');
    expect(rendered).toContain('| unit | 1 | not counted, repeats a shard | 1 (50.0%) |');
  });
});
