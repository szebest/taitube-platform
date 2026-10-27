import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

interface Timed {
  name: string;
  startedAt: string;
  completedAt: string;
}

interface RunJob extends Timed {
  conclusion: string;
  steps: Timed[];
}

export interface Run {
  id: number;
  startedAt: string;
  jobs: RunJob[];
}

export interface Stat {
  median: number;
  p90: number;
  max: number;
  runs: number;
}

const seconds = (timed: Timed): number =>
  (Date.parse(timed.completedAt) - Date.parse(timed.startedAt)) / 1000;

export function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(fraction * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

export function stat(values: readonly number[]): Stat {
  return {
    median: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    max: Math.max(...values),
    runs: values.length,
  };
}

/** Runner queue time is not in it: a run's wall time is its first job's start to its last job's end. */
export function wallSeconds(run: Run): number {
  const ended = Math.max(...run.jobs.map((job) => Date.parse(job.completedAt)));
  const started = Math.min(...run.jobs.map((job) => Date.parse(job.startedAt)));
  return (ended - started) / 1000;
}

function collect(values: Map<string, number[]>, key: string, value: number): void {
  values.set(key, [...(values.get(key) ?? []), value]);
}

/** Per-job, per-step and whole-run statistics; a job or step that did not run (skipped) is left out. */
export function summarize(runs: readonly Run[]): Map<string, Stat> {
  const values = new Map<string, number[]>();
  for (const run of runs) {
    collect(values, 'run wall time', wallSeconds(run));
    for (const job of run.jobs.filter((candidate) => candidate.conclusion === 'success')) {
      collect(values, job.name, seconds(job));
      for (const step of job.steps) {
        const duration = seconds(step);
        if (duration >= 1) collect(values, `${job.name} / ${step.name}`, duration);
      }
    }
  }
  return new Map([...values].map(([key, list]) => [key, stat(list)]));
}

export function render(summary: ReadonlyMap<string, Stat>, steps: boolean): string {
  const rows = [...summary]
    .filter(([key]) => steps || !key.includes(' / '))
    .map(
      ([key, { median, p90, max, runs }]) =>
        `| ${key} | ${median.toFixed(0)} | ${p90.toFixed(0)} | ${max.toFixed(0)} | ${runs} |`
    );
  return [
    '| Job or step | Median s | p90 s | Max s | Runs |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function gh(args: string[]): string {
  const attempts = 4;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return execFileSync('gh', args, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 60_000,
      });
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
}

/** A run id, or `id@attempt` for a rerun of it. */
function runRefs(options: { branch: string; limit: string; runs?: string }): string[] {
  if (options.runs) return options.runs.split(',');
  const listed = gh([
    'run',
    'list',
    '--workflow',
    'ci.yml',
    '--branch',
    options.branch,
    '--status',
    'success',
    '--limit',
    options.limit,
    '--json',
    'databaseId',
    '--jq',
    '.[].databaseId',
  ]);
  return listed.split('\n').filter(Boolean);
}

function loadRun(ref: string): Run {
  const [id = '', attempt] = ref.split('@');
  const attemptArgs = attempt ? ['--attempt', attempt] : [];
  const run = JSON.parse(
    gh(['run', 'view', id, ...attemptArgs, '--json', 'startedAt,jobs'])
  ) as Omit<Run, 'id'>;
  return { id: Number(id), ...run };
}

/** A run that skipped the heavy jobs (a docs-only change) has no unit job to time. */
const ranHeavyJobs = (run: Run): boolean =>
  run.jobs.some((job) => job.name.startsWith('unit') && job.conclusion === 'success');

function main(): void {
  const { values } = parseArgs({
    options: {
      branch: { type: 'string', default: 'main' },
      limit: { type: 'string', default: '40' },
      runs: { type: 'string' },
      steps: { type: 'boolean', default: false },
    },
  });
  const loaded = runRefs(values).map(loadRun);
  const kept = loaded.filter(ranHeavyJobs);
  process.stdout.write(`${kept.length} of ${loaded.length} runs ran the heavy jobs\n\n`);
  process.stdout.write(`${render(summarize(kept), values.steps)}\n`);
}

if (import.meta.main) main();
