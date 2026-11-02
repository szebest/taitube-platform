import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { UNIT_TIMINGS } from './timings/sequencer';
import type { Timings } from './timings/shards';

/** What `timings-reporter.ts` writes: a `[path, milliseconds]` pair per spec file a project ran. */
export type ShardTimings = readonly (readonly [string, number])[];

/** Each spec file's cost over every shard, summed when two projects ran it, sorted by path. */
export function timingsFrom(shards: readonly ShardTimings[]): Timings {
  const totals = new Map<string, number>();
  for (const [path, cost] of shards.flat()) totals.set(path, (totals.get(path) ?? 0) + cost);
  return Object.fromEntries([...totals].sort(([a], [b]) => (a < b ? -1 : 1)));
}

function timingsOfRun(run: string): string[] {
  const directory = mkdtempSync(join(tmpdir(), 'unit-timings-'));
  execFileSync('gh', ['run', 'download', run, '--pattern', 'unit-reports-*', '--dir', directory]);
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((file) => /unit-timings-\d+\.json$/.test(file))
    .map((file) => join(directory, file));
}

function main(): void {
  const { values, positionals } = parseArgs({
    options: { run: { type: 'string' } },
    allowPositionals: true,
  });
  const files = values.run ? timingsOfRun(values.run) : positionals;
  if (files.length === 0) throw new Error('pass --run <id> of a green CI run, or timings files');
  const timings = timingsFrom(
    files.map((file) => JSON.parse(readFileSync(file, 'utf8')) as ShardTimings)
  );
  mkdirSync(dirname(UNIT_TIMINGS), { recursive: true });
  writeFileSync(UNIT_TIMINGS, `${JSON.stringify(timings, null, 2)}\n`);
  process.stdout.write(`${Object.keys(timings).length} spec files from ${files.length} shards\n`);
}

if (import.meta.main) main();
