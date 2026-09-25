import { isDeepStrictEqual } from 'node:util';
import { load } from 'js-yaml';
import { read } from './repo-files';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface Job {
  name?: string;
  needs?: string | string[];
  if?: string;
  'timeout-minutes'?: number;
  services?: Record<string, unknown>;
  steps?: Step[];
  uses?: string;
}

interface Workflow {
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
}

/** Each job's budget in minutes, and the timeout that enforces it. */
const BUDGETS: Readonly<Record<string, number>> = {
  build: 2,
  'lint-typecheck': 2,
  unit: 3,
  'unit-bun': 3,
  integration: 3,
  'e2e-smoke': 4,
  terraform: 2,
};

const CRITICAL_PATH_MINUTES = 6;

const BUDGET_ACTION = './.github/actions/budget';
const JOB_START = 'JOB_STARTED_AT';

/** What `.github/actions/budget` holds, in seconds: the whole `unit` job and the architecture suite. */
const SECOND_BUDGETS = [
  { job: 'unit', what: 'unit', seconds: 150 },
  { job: 'lint-typecheck', what: 'test:architecture', seconds: 6 },
];
const WITH_SERVICES = new Set(['integration', 'e2e-smoke']);
/** Bun is a test runtime only: every script runs through `tsx`, so only `bun test` needs it. */
const WITH_BUN = new Set(['unit-bun']);
/** What the `terraform` job runs against `infra/terraform`, with the provider plugins cached by the lock file. */
const TERRAFORM_CHECKS = [
  /\bterraform -chdir=infra\/terraform fmt -check -recursive\b/,
  /\bterraform -chdir=infra\/terraform init -backend=false -input=false -lockfile=readonly\b/,
  /\bterraform -chdir=infra\/terraform validate\b/,
];
const PROVIDER_CACHE_KEY = "hashFiles('infra/terraform/.terraform.lock.hcl')";
const DOCS_ONLY_FILTER = { code: ['**', '!**/*.md', '!docs/**'] };

/** The scripts that run `pnpm boundaries` themselves, as `package.json` defines them. */
const RUNS_BOUNDARIES = /\bpnpm (boundaries|build|typecheck)\b/g;

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

function checks(workflow: Workflow): Check[] {
  return Object.entries(workflow.jobs)
    .filter(([, job]) => job.uses === undefined)
    .map(([key, job]) => ({ key, name: job.name ?? key, job }));
}

function longestChain(workflow: Workflow, key: string): number {
  const job = workflow.jobs[key];
  if (!job) return 0;
  const upstream = needsOf(job).map((need) => longestChain(workflow, need));
  return (job['timeout-minutes'] ?? Number.POSITIVE_INFINITY) + Math.max(0, ...upstream);
}

function shapeFindings(source: string): string[] {
  const workflow = load(source) as Workflow;
  const jobs = checks(workflow);
  const jobNamed = (name: string) => jobs.find((check) => check.name === name)?.job;
  const findings: string[] = [];

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
    if (
      name !== 'build' &&
      !(needsOf(job).includes('build') && job.if?.includes('needs.build.outputs.code'))
    ) {
      findings.push(`${name}: does not skip a docs-only change`);
    }
  }

  const filter = (jobNamed('build')?.steps ?? []).find((step) =>
    step.uses?.startsWith('dorny/paths-filter@')
  );
  if (!isDeepStrictEqual(load(String(filter?.with?.filters ?? '')), DOCS_ONLY_FILTER)) {
    findings.push('build: no path filter that skips a docs-only change');
  }
  if (filter?.with?.['predicate-quantifier'] !== 'every') {
    findings.push('build: the path filter matches a file on any one pattern');
  }

  return findings;
}

const BAD_WORKFLOW = `
permissions:
  packages: write
jobs:
  build:
    name: build
    timeout-minutes: 5
    steps:
      - uses: dorny/paths-filter@v4
        with:
          filters: |
            code:
              - '!**/*.md'
              - '!docs/**'
      - run: pnpm build && pnpm typecheck
  unit:
    name: unit
    needs: [build]
    timeout-minutes: 3
    services:
      postgres: { image: postgres }
    steps:
      - uses: ./.github/actions/setup-workspace
        with:
          bun: 'true'
      - run: pnpm db:migrate
      - run: pnpm test
      - run: pnpm test:architecture
      - uses: ./.github/actions/budget
        with:
          what: unit
          seconds: 150
          started-at: 0
  unit-bun:
    name: unit-bun
    needs: [build]
    if: needs.build.outputs.code == 'true'
    timeout-minutes: 3
    steps:
      - run: pnpm test:bun
  e2e:
    name: e2e-smoke
    needs: [build, unit]
    if: needs.build.outputs.code == 'true'
    timeout-minutes: 4
    steps:
      - run: pnpm test:architecture
  terraform:
    name: terraform
    needs: [build]
    if: needs.build.outputs.code == 'true'
    timeout-minutes: 2
    steps:
      - uses: actions/cache@v4
        with:
          key: terraform-providers
      - run: terraform -chdir=infra/terraform fmt -check
`;

describe('architecture: the CI pipeline holds its budgets', () => {
  it.each([
    'build: timeout-minutes is not 2',
    'lint-typecheck: timeout-minutes is not 2',
    'e2e-smoke: needs more than build',
    'architecture tests run in 2 jobs',
    'unit: runs pnpm test, architecture included',
    'build: runs pnpm boundaries twice',
    'unit: starts a service container',
    'unit: runs a migration',
    'e2e-smoke: its needs chain budgets 12 min',
    'unit: does not skip a docs-only change',
    'build: no path filter that skips a docs-only change',
    'build: the path filter matches a file on any one pattern',
    'the workflow grants packages: write to every job',
    'lint-typecheck: test:architecture is not held to 6 s',
    'unit: its budget does not run from the first step to the last',
    'unit: sets up Bun',
    'unit-bun: does not set up Bun',
    'terraform: does not check fmt, init and validate',
    'terraform: no provider cache keyed by the lock file',
  ])('fires on a workflow where %s', (finding) => {
    expect(shapeFindings(BAD_WORKFLOW)).toContain(finding);
  });

  it('finds ci.yml in the shape its budgets need', () => {
    expect(shapeFindings(read('.github/workflows/ci.yml'))).toEqual([]);
  });
});
