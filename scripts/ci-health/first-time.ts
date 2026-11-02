import { share, table } from './markdown';
import type { Job, Outcome, Run, RunSummary } from './model';

const REQUIRED = ['lint-typecheck', 'unit', 'unit-bun', 'integration', 'e2e-smoke'];

const FAILED: readonly (string | null)[] = ['failure', 'timed_out', 'startup_failure'];

export const failed = (job: Job): boolean => FAILED.includes(job.conclusion);

export const attemptJobs = (run: Run, attempt: number): Job[] =>
  run.jobs.filter((job) => job.run_attempt === attempt);

/** The run's own conclusion for its latest attempt; an earlier attempt is judged by its jobs. */
export function finalOutcome(run: RunSummary): Outcome {
  if (run.status !== 'completed') return 'running';
  if (run.conclusion === 'success' || run.conclusion === 'cancelled') return run.conclusion;
  return 'failure';
}

export function attemptOutcome(run: Run, attempt = 1): Outcome {
  if (attempt === run.run_attempt) return finalOutcome(run);
  const jobs = attemptJobs(run, attempt);
  if (jobs.some(failed)) return 'failure';
  return jobs.some((job) => job.conclusion === 'cancelled') ? 'cancelled' : 'success';
}

const branchOf = (run: Run): string =>
  run.event === 'pull_request' ? 'PRs' : `${run.head_branch} (${run.event})`;

export interface FirstTimeRow {
  branch: string;
  runs: number;
  cancelled: number;
  conclusive: number;
  green: number;
  requiredGreen: number;
}

export function firstTimeRows(runs: readonly Run[]): FirstTimeRow[] {
  const rows = new Map<string, FirstTimeRow>();
  for (const run of runs) {
    const branch = branchOf(run);
    const row = rows.get(branch) ?? {
      branch,
      runs: 0,
      cancelled: 0,
      conclusive: 0,
      green: 0,
      requiredGreen: 0,
    };
    rows.set(branch, row);
    row.runs += 1;
    const outcome = attemptOutcome(run);
    if (outcome === 'cancelled') row.cancelled += 1;
    if (outcome !== 'success' && outcome !== 'failure') continue;
    row.conclusive += 1;
    if (outcome === 'success') row.green += 1;
    const requiredFailed = attemptJobs(run, 1).some(
      (job) => REQUIRED.includes(job.name) && failed(job)
    );
    if (!requiredFailed) row.requiredGreen += 1;
  }
  return [...rows.values()];
}

export function renderFirstTime(rows: readonly FirstTimeRow[]): string {
  return table(
    [
      'Branch',
      'Runs',
      'Cancelled',
      'Green first time',
      `Required (${REQUIRED.join(', ')}) green first time`,
    ],
    rows.map((row) => [
      row.branch,
      row.runs,
      row.cancelled,
      share(row.green, row.conclusive),
      share(row.requiredGreen, row.conclusive),
    ])
  );
}
