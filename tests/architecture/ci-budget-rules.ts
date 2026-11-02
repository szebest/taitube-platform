import type { Check } from './ci-workflow';

/**
 * Each job's budget in minutes, and the timeout that enforces it, by the check name GitHub reports;
 * a matrix job is keyed by its job key, one row for every app it runs.
 */
const BUDGETS: Readonly<Record<string, number>> = {
  build: 2,
  'lint-typecheck': 3,
  'unit-shards': 4,
  unit: 1,
  'unit-bun-shards': 3,
  'unit-bun': 1,
  integration: 3,
  'e2e-smoke': 4,
  'e2e-client': 4,
  visual: 4,
  terraform: 2,
};

const BUDGET_ACTION = './.github/actions/budget';
const JOB_START = 'JOB_STARTED_AT';

/** What `.github/actions/budget` holds, in seconds: the whole `unit` job and the architecture suite. */
const SECOND_BUDGETS = [
  { job: 'unit-shards', what: 'unit', seconds: 200, wholeJob: true },
  { job: 'lint-typecheck', what: 'test:architecture', seconds: 12, wholeJob: false },
];

export function budgetFindings(jobs: readonly Check[]): string[] {
  const findings: string[] = [];
  const jobNamed = (name: string) =>
    (jobs.find((check) => check.name === name) ?? jobs.find((check) => check.key === name))?.job;

  for (const [name, budget] of Object.entries(BUDGETS)) {
    const named = jobs.filter((check) => check.key === name || check.name === name);
    if (named.length === 0 || named.some(({ job }) => job['timeout-minutes'] !== budget))
      findings.push(`${name}: timeout-minutes is not ${budget}`);
  }

  for (const { job: name, what, seconds, wholeJob } of SECOND_BUDGETS) {
    const steps = jobNamed(name)?.steps ?? [];
    const budget = steps.find((step) => step.uses === BUDGET_ACTION && step.with?.what === what);
    if (budget?.with?.seconds !== seconds) {
      findings.push(`${name}: ${what} is not held to ${seconds} s`);
    }
    const startsWithTheJob = steps[0]?.run?.includes(JOB_START) && steps.at(-1) === budget;
    if (budget && wholeJob && !startsWithTheJob) {
      findings.push(`${name}: its budget does not run from the first step to the last`);
    }
  }
  return findings;
}
