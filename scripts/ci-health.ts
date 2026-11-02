import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, promisify } from 'node:util';
import { type CauseCount, causeOf, renderCauses } from './ci-health/causes';
import { AGGREGATES, failures, renderFailures } from './ci-health/failures';
import { failed, firstTimeRows, renderFirstTime } from './ci-health/first-time';
import { flips, renderFlips } from './ci-health/flips';
import { type Branch, type Exec, gitHub, mapLimit } from './ci-health/github';
import { budgetsOf, margins, renderMargins } from './ci-health/margins';
import { renderMerges } from './ci-health/merges';
import type { Job, Merge, Run } from './ci-health/model';
import { renderRetries, retries } from './ci-health/retries';
import { breaches } from './ci-health/thresholds';

const MERGES = 20;

const execFileAsync = promisify(execFile);

const ghExec: Exec = async (args) => {
  const attempts = 4;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const { stdout } = await execFileAsync('gh', args, {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        timeout: 120_000,
      });
      return stdout;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
};

export function measure(runs: readonly Run[], workflow: string) {
  const measured = {
    firstTime: firstTimeRows(runs),
    failures: failures(runs),
    margins: margins(runs, budgetsOf(workflow)),
    flips: flips(runs),
    retries: retries(runs),
  };
  return { ...measured, breaches: breaches(measured) };
}

export type Health = ReturnType<typeof measure> & { causes?: CauseCount[]; merges?: Merge[] };

/** Every failed root job of every attempt, with whether the same job later passed on the same commit. */
export function failedExecutions(runs: readonly Run[]): { job: Job; flipped: boolean }[] {
  const passed = new Set(
    runs.flatMap((run) =>
      run.jobs
        .filter((job) => job.conclusion === 'success')
        .map((job) => `${run.head_sha} ${job.name}`)
    )
  );
  return runs.flatMap((run) =>
    run.jobs
      .filter((job) => failed(job) && !AGGREGATES.includes(job.name))
      .map((job) => ({ job, flipped: passed.has(`${run.head_sha} ${job.name}`) }))
  );
}

export function countCauses(
  classified: readonly { cause: string; flipped: boolean }[]
): CauseCount[] {
  const counts = new Map<string, CauseCount>();
  for (const { cause, flipped } of classified) {
    const row = counts.get(cause) ?? { cause, jobs: 0, flipped: 0 };
    counts.set(cause, row);
    row.jobs += 1;
    if (flipped) row.flipped += 1;
  }
  return [...counts.values()];
}

export function render(health: Health, window: string): string {
  const sections = [
    `# CI health, ${window}`,
    '## 1. Green first time',
    renderFirstTime(health.firstTime),
    '## 2. Failures per job (attempt 1 of the failed runs)',
    renderFailures(health.failures),
    '## 3. Budgets and their margins (successful runs, every attempt)',
    renderMargins(health.margins),
    '## 4. Flips: a job that failed and later passed on the same commit',
    renderFlips(health.flips),
    '## 4b. Passed only on a retry (counted as flips)',
    renderRetries(health.retries),
  ];
  if (health.merges) sections.push('## 5. Merges', renderMerges(health.merges));
  if (health.causes)
    sections.push('## 6. Failure causes, from the logs', renderCauses(health.causes));
  sections.push(
    '## Thresholds',
    health.breaches.length === 0
      ? 'Every threshold holds.'
      : health.breaches.map((line) => `- ${line}`).join('\n')
  );
  return `${sections.join('\n\n')}\n`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      branch: { type: 'string', default: 'main' },
      runs: { type: 'string', default: '50' },
      created: { type: 'string' },
      workflow: { type: 'string', default: '.github/workflows/ci.yml' },
      causes: { type: 'boolean', default: false },
      merges: { type: 'boolean', default: false },
      json: { type: 'string' },
      check: { type: 'boolean', default: false },
    },
  });
  const branch = values.branch as Branch;
  if (!['main', 'pr', 'all'].includes(branch)) throw new Error('--branch is main, pr or all');

  const github = gitHub(ghExec);
  const runs = await github.runs({ branch, runs: Number(values.runs), created: values.created });
  const health: Health = measure(runs, readFileSync(values.workflow, 'utf8'));
  if (values.causes) {
    const classified = await mapLimit(failedExecutions(runs), 8, async ({ job, flipped }) => ({
      cause: causeOf(await github.log(job.id)),
      flipped,
    }));
    health.causes = countCauses(classified);
  }
  if (values.merges) health.merges = await github.merges(MERGES);

  const window = `${branch}, ${runs.length} runs${values.created ? `, created ${values.created}` : ''}`;
  process.stdout.write(render(health, window));
  if (values.json)
    writeFileSync(values.json, `${JSON.stringify({ window, ...health }, null, 2)}\n`);
  if (values.check && health.breaches.length > 0) process.exitCode = 1;
}

if (import.meta.main) await main();
