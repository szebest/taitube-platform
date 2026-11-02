import { attemptOutcome, firstTimeRows, renderFirstTime } from '../first-time';
import type { Run } from '../model';
import { job, prRun, run } from './runs';

const rerun = (first: string, second: string): Run => ({
  ...run({ run_attempt: 2, conclusion: second }),
  jobs: [
    job('unit-shard-2', { conclusion: first, run_attempt: 1 }),
    job('unit-shard-2', { conclusion: second, run_attempt: 2 }),
  ],
});

describe('attemptOutcome', () => {
  it.each([
    { scenario: 'a green run', subject: run(), attempt: 1, expected: 'success' },
    {
      scenario: 'a red run',
      subject: run({ conclusion: 'failure' }),
      attempt: 1,
      expected: 'failure',
    },
    {
      scenario: 'a timed-out run',
      subject: run({ conclusion: 'timed_out' }),
      attempt: 1,
      expected: 'failure',
    },
    {
      scenario: 'a cancelled run',
      subject: run({ conclusion: 'cancelled' }),
      attempt: 1,
      expected: 'cancelled',
    },
    {
      scenario: 'a running run',
      subject: run({ status: 'in_progress', conclusion: null }),
      attempt: 1,
      expected: 'running',
    },
    {
      scenario: 'the red first attempt of a rerun',
      subject: rerun('failure', 'success'),
      attempt: 1,
      expected: 'failure',
    },
    {
      scenario: 'the green second attempt of a rerun',
      subject: rerun('failure', 'success'),
      attempt: 2,
      expected: 'success',
    },
    {
      scenario: 'a cancelled first attempt',
      subject: rerun('cancelled', 'success'),
      attempt: 1,
      expected: 'cancelled',
    },
  ])('reads $scenario as $expected', ({ subject, attempt, expected }) => {
    expect(attemptOutcome(subject, attempt)).toBe(expected);
  });
});

describe('firstTimeRows', () => {
  const rows = firstTimeRows([
    run(),
    run({ conclusion: 'cancelled' }),
    run({ conclusion: 'failure', jobs: [job('visual-3', { conclusion: 'failure' })] }),
    prRun('b2', { unit: 'failure' }),
    prRun('c3', { 'lint-typecheck': 'success' }),
    rerun('failure', 'success'),
  ]);

  it.each([
    { branch: 'main (push)', runs: 4, cancelled: 1, conclusive: 3, green: 1, requiredGreen: 3 },
    { branch: 'PRs', runs: 2, cancelled: 0, conclusive: 2, green: 1, requiredGreen: 1 },
  ])('counts $branch green first time, required checks apart', (expected) => {
    expect(rows).toContainEqual(expected);
  });

  it('renders a row per branch with the rate', () => {
    expect(renderFirstTime(rows)).toContain(
      '| main (push) | 4 | 1 | 1 of 3, 33.3% | 3 of 3, 100.0% |'
    );
  });
});
