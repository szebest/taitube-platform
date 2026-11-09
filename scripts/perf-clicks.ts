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

/**
 * `pnpm perf:clicks <label> [--against <label>]`: runs the web app's click path (`e2e/perf`) against the
 * in-process stack and writes `.perf/<label>.json`; with `--against`, prints that run beside this one.
 */
function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { against: { type: 'string' }, 'port-base': { type: 'string', default: '5740' } },
  });
  const label = positionals[0] ?? 'run';

  const run = spawnSync('npx', ['playwright', 'test', '-c', CONFIG], {
    cwd: join(ROOT, 'apps/client/web'),
    stdio: 'inherit',
    env: {
      ...process.env,
      PERF_LABEL: label,
      PERF_OUT: OUT,
      E2E_PORT_BASE: values['port-base'],
    },
  });
  if (run.status !== 0) process.exit(run.status ?? 1);

  const baseline = values.against ? readRun(values.against) : undefined;
  console.log(renderClickPathTable(readRun(label), baseline));
}

main();
