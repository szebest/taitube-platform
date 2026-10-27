import { isDeepStrictEqual } from 'node:util';
import { load } from 'js-yaml';
import {
  AREA_FILTERS,
  BUDGET_ACTION,
  BUDGETS,
  CRITICAL_PATH_MINUTES,
  EVERY_EVENT,
  JOB_AREA,
  JOB_START,
  PROVIDER_CACHE_KEY,
  SECOND_BUDGETS,
  TERRAFORM_CHECKS,
  WARM_CACHE_CRON,
  WITH_BUN,
  WITH_SERVICES,
} from './ci-shape-limits';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface Job {
  name?: string;
  needs?: string | string[];
  strategy?: { matrix?: Record<string, readonly (string | number)[]> };
  if?: string;
  'timeout-minutes'?: number;
  services?: Record<string, unknown>;
  steps?: Step[];
  outputs?: Record<string, string>;
  uses?: string;
}

interface PullRequestTrigger {
  branches?: string[];
  'branches-ignore'?: string[];
}

interface Triggers {
  pull_request?: PullRequestTrigger | null;
  schedule?: { cron?: string }[];
}

interface Workflow {
  /** GitHub takes one event name, a list of them, or a map of each event to its filters. */
  on?: string | string[] | Triggers;
  concurrency?: { group?: string };
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
}

/** The scripts that run `pnpm boundaries` themselves, as `package.json` defines them. */
const RUNS_BOUNDARIES = /\bpnpm (boundaries|build|typecheck)\b/g;

function triggersOf(workflow: Workflow): Triggers {
  const { on } = workflow;
  if (on === undefined) return {};
  if (typeof on === 'string' || Array.isArray(on)) {
    return Object.fromEntries([on].flat().map((event) => [event, null]));
  }
  return on;
}

function needsOf(job: Job): string[] {
  if (job.needs === undefined) return [];
  if (typeof job.needs === 'string') return [job.needs];
  return job.needs;
}

const setsUpBun = (job: Job): boolean =>
  (job.steps ?? []).some(
    (step) => step.uses?.startsWith('oven-sh/setup-bun@') || step.with?.bun === 'true'
  );

const runs = (job: Job): string => (job.steps ?? []).map((step) => step.run ?? '').join('\n');

interface Check {
  key: string;
  /** The check name GitHub reports, which is what the budgets name. */
  name: string;
  job: Job;
}

/** Every combination of a matrix's values, as the names a `${{ matrix.<key> }}` reads. */
function matrixCombinations(
  matrix: Record<string, readonly (string | number)[]>
): Record<string, string>[] {
  return Object.entries(matrix).reduce<Record<string, string>[]>(
    (combinations, [key, values]) =>
      combinations.flatMap((combination) =>
        values.map((value) => ({ ...combination, [key]: String(value) }))
      ),
    [{}]
  );
}

/** One check per job, or per matrix combination, named as GitHub reports it. */
function checks(workflow: Workflow): Check[] {
  return Object.entries(workflow.jobs)
    .filter(([, job]) => job.uses === undefined)
    .flatMap(([key, job]) => {
      const name = job.name ?? key;
      const matrix = job.strategy?.matrix;
      if (matrix === undefined) return [{ key, name, job }];
      return matrixCombinations(matrix).map((combination) => ({
        key,
        name: name.replace(
          /\$\{\{\s*matrix\.(\w+)\s*\}\}/g,
          (_, variable: string) => combination[variable] ?? ''
        ),
        job,
      }));
    });
}

function longestChain(workflow: Workflow, key: string): number {
  const job = workflow.jobs[key];
  if (!job) return 0;
  const upstream = needsOf(job).map((need) => longestChain(workflow, need));
  return (job['timeout-minutes'] ?? Number.POSITIVE_INFINITY) + Math.max(0, ...upstream);
}

export function shapeFindings(source: string): string[] {
  const workflow = load(source) as Workflow;
  const jobs = checks(workflow);
  const jobNamed = (name: string) =>
    (jobs.find((check) => check.name === name) ?? jobs.find((check) => check.key === name))?.job;
  const findings: string[] = [];

  const triggers = triggersOf(workflow);
  const pullRequest = triggers.pull_request;
  if (!('pull_request' in triggers)) {
    findings.push('a pull request gets no CI');
  } else if (
    pullRequest?.branches !== undefined ||
    pullRequest?.['branches-ignore'] !== undefined
  ) {
    findings.push('a pull request into a branch other than main gets no CI');
  }

  if (!triggers.schedule?.some((entry) => entry.cron === WARM_CACHE_CRON)) {
    findings.push(`main's caches are not kept warm by the ${WARM_CACHE_CRON} schedule`);
  }
  if (!workflow.concurrency?.group?.includes('github.event_name')) {
    findings.push('a scheduled run can cancel the run of a push to main');
  }

  if (workflow.permissions?.packages === 'write') {
    findings.push('the workflow grants packages: write to every job');
  }

  for (const [name, budget] of Object.entries(BUDGETS)) {
    if (jobNamed(name)?.['timeout-minutes'] !== budget)
      findings.push(`${name}: timeout-minutes is not ${budget}`);
  }

  for (const { job: name, what, seconds } of SECOND_BUDGETS) {
    const steps = jobNamed(name)?.steps ?? [];
    const budget = steps.find((step) => step.uses === BUDGET_ACTION && step.with?.what === what);
    if (budget?.with?.seconds !== seconds) {
      findings.push(`${name}: ${what} is not held to ${seconds} s`);
    }
    const wholeJob = what === name;
    const startsWithTheJob = steps[0]?.run?.includes(JOB_START) && steps.at(-1) === budget;
    if (budget && wholeJob && !startsWithTheJob) {
      findings.push(`${name}: its budget does not run from the first step to the last`);
    }
  }

  const terraform = jobNamed('terraform');
  if (terraform && !TERRAFORM_CHECKS.every((check) => check.test(runs(terraform)))) {
    findings.push('terraform: does not check fmt, init and validate');
  }
  const providerCache = (terraform?.steps ?? []).find((step) =>
    step.uses?.startsWith('actions/cache@')
  );
  if (terraform && !String(providerCache?.with?.key ?? '').includes(PROVIDER_CACHE_KEY)) {
    findings.push('terraform: no provider cache keyed by the lock file');
  }

  const e2e = jobNamed('e2e-smoke');
  if (e2e && needsOf(e2e).join() !== 'build') findings.push('e2e-smoke: needs more than build');

  const architecture = jobs.filter(({ job }) => /\bpnpm test:architecture\b/.test(runs(job)));
  if (architecture.length !== 1)
    findings.push(`architecture tests run in ${architecture.length} jobs`);

  for (const { key, name, job } of jobs) {
    const script = runs(job);
    if (/\bpnpm test\s*($|\n|&&)/.test(script))
      findings.push(`${name}: runs pnpm test, architecture included`);
    if ((script.match(RUNS_BOUNDARIES) ?? []).length > 1)
      findings.push(`${name}: runs pnpm boundaries twice`);
    if (job.services && !WITH_SERVICES.has(name))
      findings.push(`${name}: starts a service container`);
    if (/\bdb:migrate\b/.test(script) && !WITH_SERVICES.has(name))
      findings.push(`${name}: runs a migration`);
    if (setsUpBun(job) && !WITH_BUN.has(name)) findings.push(`${name}: sets up Bun`);
    if (!setsUpBun(job) && WITH_BUN.has(name)) findings.push(`${name}: does not set up Bun`);

    const chain = longestChain(workflow, key);
    if (chain > CRITICAL_PATH_MINUTES)
      findings.push(`${name}: its needs chain budgets ${chain} min`);
    const area = JOB_AREA[key] ?? 'code';
    if (
      name !== 'build' &&
      !(needsOf(job).includes('build') && job.if?.includes(`needs.build.outputs.${area}`))
    ) {
      findings.push(`${name}: does not skip a change outside the ${area} area`);
    }
  }

  const filter = (jobNamed('build')?.steps ?? []).find((step) =>
    step.uses?.startsWith('dorny/paths-filter@')
  );
  const filters = filter?.with?.filters;
  if (!isDeepStrictEqual(typeof filters === 'string' ? load(filters) : undefined, AREA_FILTERS)) {
    findings.push('build: the path filter does not name every area');
  }
  const outputs = workflow.jobs.build?.outputs ?? {};
  for (const area of Object.keys(AREA_FILTERS)) {
    const output = String(outputs[area] ?? '');
    if (!output.startsWith(`\${{ ${EVERY_EVENT} || `)) {
      findings.push(`build: the ${area} output does not run on every push, tag and schedule`);
    }
  }
  if (filter?.with?.['predicate-quantifier'] !== 'every') {
    findings.push('build: the path filter matches a file on any one pattern');
  }

  return findings;
}
