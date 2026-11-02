import { attemptJobs, attemptOutcome, failed } from './first-time';
import { percent, table } from './markdown';
import type { Run } from './model';

/** Red whenever one of their shards is, so a failure of theirs names no cause of its own. */
export const AGGREGATES: readonly string[] = ['unit', 'unit-bun'];

/** A matrix job by its job, not its shard: `visual-7` and `visual-10` are both `visual`. */
export const jobGroup = (name: string): string => name.replace(/-\d+$/, '');

interface FailureRow {
  job: string;
  rows: number;
  runs: number;
  aggregate: boolean;
}

export interface Failures {
  failedRuns: number;
  rootRows: number;
  rows: FailureRow[];
}

export function failures(runs: readonly Run[]): Failures {
  const red = runs.filter((run) => attemptOutcome(run) === 'failure');
  const byJob = new Map<string, FailureRow>();
  for (const run of red) {
    const groups = attemptJobs(run, 1)
      .filter(failed)
      .map((job) => jobGroup(job.name));
    for (const group of groups) {
      const row = byJob.get(group) ?? {
        job: group,
        rows: 0,
        runs: 0,
        aggregate: AGGREGATES.includes(group),
      };
      byJob.set(group, row);
      row.rows += 1;
    }
    for (const group of new Set(groups)) {
      const row = byJob.get(group);
      if (row) row.runs += 1;
    }
  }
  const rows = [...byJob.values()].sort(
    (a, b) => Number(a.aggregate) - Number(b.aggregate) || b.rows - a.rows
  );
  const rootRows = rows.filter((row) => !row.aggregate).reduce((sum, row) => sum + row.rows, 0);
  return { failedRuns: red.length, rootRows, rows };
}

export function renderFailures({ failedRuns, rootRows, rows }: Failures): string {
  return table(
    [
      'Job',
      'Failed job rows',
      `Share of the ${rootRows} root rows`,
      `Failed runs containing it (of ${failedRuns})`,
    ],
    rows.map((row) => [
      row.job,
      row.rows,
      row.aggregate ? 'not counted, repeats a shard' : percent(row.rows, rootRows),
      `${row.runs} (${percent(row.runs, failedRuns)})`,
    ])
  );
}
