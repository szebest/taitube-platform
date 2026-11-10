import type { Check, Job, Workflow } from './ci-workflow';

/**
 * Each job's outer bound in minutes, by the check name GitHub reports; a matrix job is keyed by its
 * job key, one row for every app it runs. docs/standards/testing.md has the formula behind each.
 */
const TIMEOUTS: Readonly<Record<string, number>> = {
  build: 3,
  'lint-typecheck': 4,
  'unit-shards': 5,
  unit: 1,
  'unit-bun-shards': 4,
  'unit-bun': 1,
  integration: 6,
  'e2e-smoke': 4,
  'e2e-client': 4,
  visual: 5,
  terraform: 2,
};

const BUDGET_ACTION = './.github/actions/budget';

/** What `.github/actions/budget` holds, in seconds, each on the step whose id it names. */
const STEP_BUDGETS = [
  { job: 'unit-shards', step: 'unit-tests', seconds: 240 },
  { job: 'lint-typecheck', step: 'architecture', seconds: 30 },
  { job: 'integration', step: 'integration-tests', seconds: 240 },
];

/** A budget measures a step that runs before it, and fires before its job's timeout would. */
function stepBudgetFindings(key: string, job: Job): string[] {
  const steps = job.steps ?? [];
  const limit = 60 * (job['timeout-minutes'] ?? Number.POSITIVE_INFINITY);
  return steps.flatMap((step, index) => {
    if (step.uses !== BUDGET_ACTION) return [];
    const named = step.with?.step;
    const seconds = Number(step.with?.seconds);
    const found: string[] = [];
    if (!steps.slice(0, index).some((earlier) => earlier.id !== undefined && earlier.id === named))
      found.push(`${key}: a budget names no step before it`);
    if (!(seconds < limit))
      found.push(`${key}: a budget of ${seconds} s is not below the job's ${limit} s timeout`);
    return found;
  });
}

export function budgetFindings(workflow: Workflow, jobs: readonly Check[]): string[] {
  const findings: string[] = [];

  for (const [name, budget] of Object.entries(TIMEOUTS)) {
    const named = jobs.filter((check) => check.key === name || check.name === name);
    if (named.length === 0 || named.some(({ job }) => job['timeout-minutes'] !== budget))
      findings.push(`${name}: timeout-minutes is not ${budget}`);
  }

  for (const { job, step, seconds } of STEP_BUDGETS) {
    const budget = (workflow.jobs[job]?.steps ?? []).find(
      (candidate) => candidate.uses === BUDGET_ACTION && candidate.with?.step === step
    );
    if (budget?.with?.seconds !== seconds)
      findings.push(`${job}: ${step} is not held to ${seconds} s`);
  }

  for (const [key, job] of Object.entries(workflow.jobs))
    findings.push(...stepBudgetFindings(key, job));
  return findings;
}
