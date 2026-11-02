import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { UNIT_TIMINGS } from './timings/sequencer';
import type { Timings } from './timings/shards';

/** What `timings-reporter.ts` writes: a `[path, milliseconds]` pair per spec file a project ran. */
export type ShardTimings = readonly (readonly [string, number])[];

/**
 * Each spec file's cost: summed over a run's shards when two projects ran it, then the mean over
 * the runs, since one run's cost depends on which files shared its worker. Sorted by path.
 */
export function timingsFrom(runs: readonly (readonly ShardTimings[])[]): Timings {
  const perRun = runs.map((shards) => {
    const totals = new Map<string, number>();
    for (const [path, cost] of shards.flat()) totals.set(path, (totals.get(path) ?? 0) + cost);
    return totals;
  });
  const paths = [...new Set(perRun.flatMap((totals) => [...totals.keys()]))].sort();
  return Object.fromEntries(
    paths.map((path) => {
      const costs = perRun.flatMap((totals) => totals.get(path) ?? []);
      return [path, Math.round(costs.reduce((sum, cost) => sum + cost, 0) / costs.length)];
    })
  );
}

function timingsOfRun(run: string): string[] {
  const directory = mkdtempSync(join(tmpdir(), 'unit-timings-'));
  execFileSync('gh', ['run', 'download', run, '--pattern', 'unit-reports-*', '--dir', directory]);
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((file) => /unit-timings-\d+\.json$/.test(file))
    .map((file) => join(directory, file));
}

function main(): void {
  const { values } = parseArgs({ options: { run: { type: 'string', multiple: true } } });
  const runs = (values.run ?? []).map((run) =>
    timingsOfRun(run).map((file) => JSON.parse(readFileSync(file, 'utf8')) as ShardTimings)
  );
  if (runs.length === 0) throw new Error('pass --run <id> of one or more green CI runs');
  const timings = timingsFrom(runs);
  mkdirSync(dirname(UNIT_TIMINGS), { recursive: true });
  writeFileSync(UNIT_TIMINGS, `${JSON.stringify(timings, null, 2)}\n`);
  process.stdout.write(`${Object.keys(timings).length} spec files from ${runs.length} runs\n`);
}

if (import.meta.main) main();
