import { percentile, type Run, render, stat, summarize, wallSeconds } from '../ci-timings';

const at = (second: number) => new Date(Date.UTC(2026, 9, 27, 12, 0, second)).toISOString();

const job = (name: string, start: number, end: number, conclusion = 'success') => ({
  name,
  startedAt: at(start),
  completedAt: at(end),
  conclusion,
  steps: [{ name: 'Run tests', startedAt: at(start + 5), completedAt: at(end - 5) }],
});

const run = (id: number, unitEnd: number): Run => ({
  id,
  startedAt: at(0),
  jobs: [job('build', 0, 40), job('unit', 40, unitEnd)],
});

describe('percentile', () => {
  it.each([
    { values: [5, 1, 3], fraction: 0.5, expected: 3 },
    { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], fraction: 0.9, expected: 9 },
    { values: [7], fraction: 0.9, expected: 7 },
    { values: [], fraction: 0.5, expected: 0 },
  ])('$fraction of $values is $expected', ({ values, fraction, expected }) => {
    expect(percentile(values, fraction)).toBe(expected);
  });
});

describe('stat', () => {
  it('reports the median, p90, max and count', () => {
    expect(stat([10, 20, 30])).toEqual({ median: 20, p90: 30, max: 30, runs: 3 });
  });
});

describe('wallSeconds', () => {
  it('runs from the first job start to the last job end', () => {
    expect(wallSeconds(run(1, 200))).toBe(200);
  });
});

describe('summarize', () => {
  it('summarizes jobs, steps and the wall time over the runs', () => {
    const summary = summarize([run(1, 100), run(2, 140), run(3, 120)]);
    expect(summary.get('unit')?.median).toBe(80);
    expect(summary.get('unit / Run tests')?.median).toBe(70);
    expect(summary.get('run wall time')?.max).toBe(140);
  });

  it('leaves out a job that did not succeed', () => {
    const skipped: Run = {
      ...run(1, 100),
      jobs: [job('build', 0, 40), job('unit', 40, 100, 'skipped')],
    };
    expect(summarize([skipped]).has('unit')).toBe(false);
  });
});

describe('render', () => {
  const summary = summarize([run(1, 100)]);

  it('prints a row per job and hides the steps by default', () => {
    expect(render(summary, false)).toContain('| unit | 60 | 60 | 60 | 1 |');
    expect(render(summary, false)).not.toContain('Run tests');
  });

  it('prints the steps on request', () => {
    expect(render(summary, true)).toContain('| unit / Run tests | 50 | 50 | 50 | 1 |');
  });
});
