import type { Job, Run } from '../model';

export const at = (second: number): string =>
  new Date(Date.UTC(2026, 9, 31, 12, 0, second)).toISOString();

export const job = (name: string, overrides: Partial<Job> = {}): Job => ({
  id: 1,
  run_attempt: 1,
  name,
  conclusion: 'success',
  started_at: at(0),
  completed_at: at(100),
  steps: [],
  ...overrides,
});

export const run = (overrides: Partial<Run> = {}): Run => ({
  id: 1,
  run_attempt: 1,
  head_sha: 'a1',
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  created_at: at(0),
  check_suite_id: 1,
  jobs: [job('build')],
  retried: [],
  ...overrides,
});

/** A pull request run of `sha` whose jobs are `name: conclusion`, every one on attempt `attempt`. */
export const prRun = (sha: string, jobs: Record<string, string>, attempt = 1): Run =>
  run({
    head_sha: sha,
    head_branch: `ticket/${sha}`,
    event: 'pull_request',
    run_attempt: attempt,
    conclusion: Object.values(jobs).every((value) => value === 'success') ? 'success' : 'failure',
    jobs: Object.entries(jobs).map(([name, conclusion], index) =>
      job(name, { conclusion, run_attempt: attempt, started_at: at(attempt * 1000 + index) })
    ),
  });
