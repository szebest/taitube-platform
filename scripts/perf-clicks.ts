import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderClickPathTable } from './perf-clicks/click-path-table';
import type { ClickPathSummary } from './perf-clicks/summarize-click-path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, '.perf');
const CONFIG = join('e2e', 'perf', 'playwright.config.ts');

const readRun = (label: string): ClickPathSummary =>
  JSON.parse(readFileSync(join(OUT, `${label}.json`), 'utf8'));

export interface ClickRun {
  label: string;
  against: string | undefined;
  env: Record<string, string>;
}

/** What `pnpm perf:clicks <label> [--against <label>] [--port-base <n>]` asks for, and the env the click path runs with. */
export function parseClickRun(args: readonly string[]): ClickRun {
  const { positionals, values } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { against: { type: 'string' }, 'port-base': { type: 'string', default: '5740' } },
  });
  const label = positionals[0] ?? 'run';
  return {
    label,
    against: values.against,
    env: { PERF_LABEL: label, PERF_OUT: OUT, E2E_PORT_BASE: values['port-base'] },
  };
}

/** Runs the web app's click path (`e2e/perf`) against the in-process stack and writes `.perf/<label>.json`; with `--against`, prints that run beside this one. */
function main() {
  const { label, against, env } = parseClickRun(process.argv.slice(2));

  const run = spawnSync('npx', ['playwright', 'test', '-c', CONFIG], {
    cwd: join(ROOT, 'apps/client/web'),
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (run.status !== 0) process.exit(run.status ?? 1);

  const baseline = against ? readRun(against) : undefined;
  process.stdout.write(`${renderClickPathTable(readRun(label), baseline)}\n`);
}

if (import.meta.main) main();
