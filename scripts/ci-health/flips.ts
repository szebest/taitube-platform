import { AGGREGATES, jobGroup } from './failures';
import { attemptOutcome, failed } from './first-time';
import { percent, share, table } from './markdown';
import type { Run } from './model';

export interface Flips {
  /** A job that failed and later passed on the same commit, once per (commit, job). */
  byJob: { job: string; flips: number }[];
  rootFlips: number;
  /** Commits with a root flip, or a test that passed only on its retry. */
  flippedCommits: number;
  conclusiveCommits: number;
  reruns: number;
  runs: number;
}

export function flips(runs: readonly Run[]): Flips {
  const executions = runs
    .flatMap((run) => run.jobs.map((job) => ({ sha: run.head_sha, job })))
    .sort((a, b) => Date.parse(a.job.started_at) - Date.parse(b.job.started_at));
  const failedAt = new Set<string>();
  const flipped = new Map<string, { sha: string; name: string }>();
  for (const { sha, job } of executions) {
    const key = `${sha} ${job.name}`;
    if (failed(job)) failedAt.add(key);
    else if (job.conclusion === 'success' && failedAt.has(key))
      flipped.set(key, { sha, name: job.name });
  }

  const counts = new Map<string, number>();
  const rootCommits = new Set<string>();
  for (const { sha, name } of flipped.values()) {
    const group = jobGroup(name);
    counts.set(group, (counts.get(group) ?? 0) + 1);
    if (!AGGREGATES.includes(group)) rootCommits.add(sha);
  }
  for (const run of runs) if (run.retried.length > 0) rootCommits.add(run.head_sha);
  const byJob = [...counts]
    .map(([job, count]) => ({ job, flips: count }))
    .sort(
      (a, b) =>
        Number(AGGREGATES.includes(a.job)) - Number(AGGREGATES.includes(b.job)) || b.flips - a.flips
    );
  const conclusive = runs.filter((run) =>
    [...Array(run.run_attempt).keys()].some((index) => {
      const outcome = attemptOutcome(run, index + 1);
      return outcome === 'success' || outcome === 'failure';
    })
  );

  return {
    byJob,
    rootFlips: byJob
      .filter((row) => !AGGREGATES.includes(row.job))
      .reduce((sum, row) => sum + row.flips, 0),
    flippedCommits: rootCommits.size,
    conclusiveCommits: new Set(conclusive.map((run) => run.head_sha)).size,
    reruns: runs.filter((run) => run.run_attempt > 1).length,
    runs: runs.length,
  };
}

export const flipRate = ({ flippedCommits, conclusiveCommits }: Flips): number =>
  conclusiveCommits === 0 ? 0 : flippedCommits / conclusiveCommits;

export function renderFlips(result: Flips): string {
  const rows = result.byJob.map(({ job, flips: count }) => [
    job,
    count,
    AGGREGATES.includes(job) ? 'repeats a shard' : percent(count, result.rootFlips),
  ]);
  return [
    `${share(result.flippedCommits, result.conclusiveCommits)} of the conclusive commits had a root flip or a pass on retry; ${share(result.reruns, result.runs)} of the runs are reruns.`,
    '',
    table(
      ['Job that flipped', 'Flips (commit, job)', `Share of the ${result.rootFlips} root flips`],
      rows
    ),
  ].join('\n');
}
