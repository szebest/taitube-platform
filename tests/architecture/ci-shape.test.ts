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
};

const CRITICAL_PATH_MINUTES = 6;
const WITH_SERVICES = new Set(['integration', 'e2e-smoke']);
const DOCS_ONLY = ['!**/*.md', '!docs/**'];

/** The scripts that run `pnpm boundaries` themselves, as `package.json` defines them. */
const RUNS_BOUNDARIES = /\bpnpm (boundaries|build|typecheck)\b/g;

function needsOf(job: Job): string[] {
  if (job.needs === undefined) return [];
  if (typeof job.needs === 'string') return [job.needs];
  return job.needs;
}

const runs = (job: Job): string => (job.steps ?? []).map((step) => step.run ?? '').join('\n');

/** The workflow's jobs by the check name GitHub reports, which is what the budgets name. */
function checks(workflow: Workflow): Map<string, Job> {
  return new Map(
    Object.entries(workflow.jobs)
      .filter(([, job]) => job.uses === undefined)
      .map(([key, job]) => [job.name ?? key, job])
  );
}

function longestChain(workflow: Workflow, key: string): number {
  const job = workflow.jobs[key] as Job;
  const upstream = needsOf(job).map((need) => longestChain(workflow, need));
  return (job['timeout-minutes'] ?? Number.POSITIVE_INFINITY) + Math.max(0, ...upstream);
}

function shapeFindings(source: string): string[] {
  const workflow = load(source) as Workflow;
  const jobs = checks(workflow);
  const keyOf = new Map(Object.entries(workflow.jobs).map(([key, job]) => [job, key]));
  const findings: string[] = [];

  for (const [name, budget] of Object.entries(BUDGETS)) {
    const job = jobs.get(name);
    if (job?.['timeout-minutes'] !== budget)
      findings.push(`${name}: timeout-minutes is not ${budget}`);
  }

  const e2e = jobs.get('e2e-smoke');
  if (e2e && needsOf(e2e).join() !== 'build') findings.push('e2e-smoke: needs more than build');

  const architecture = [...jobs].filter(([, job]) => /\bpnpm test:architecture\b/.test(runs(job)));
  if (architecture.length !== 1)
    findings.push(`architecture tests run in ${architecture.length} jobs`);

  for (const [name, job] of jobs) {
    const script = runs(job);
    if (/\bpnpm test\s*($|\n|&&)/.test(script))
      findings.push(`${name}: runs pnpm test, architecture included`);
    if ((script.match(RUNS_BOUNDARIES) ?? []).length > 1)
      findings.push(`${name}: runs pnpm boundaries twice`);
    if (job.services && !WITH_SERVICES.has(name))
      findings.push(`${name}: starts a service container`);
    if (/\bdb:migrate\b/.test(script) && !WITH_SERVICES.has(name))
      findings.push(`${name}: runs a migration`);

    const key = keyOf.get(job) as string;
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

  const filter = (jobs.get('build')?.steps ?? []).find((step) =>
    step.uses?.startsWith('dorny/paths-filter@')
  );
  const patterns = String(filter?.with?.filters ?? '');
  if (!DOCS_ONLY.every((pattern) => patterns.includes(`'${pattern}'`))) {
    findings.push('build: no path filter that skips a docs-only change');
  }

  return findings;
}

const BAD_WORKFLOW = `
jobs:
  build:
    name: build
    timeout-minutes: 5
    steps:
      - run: pnpm build && pnpm typecheck
  unit:
    name: unit
    needs: [build]
    timeout-minutes: 3
    services:
      postgres: { image: postgres }
    steps:
      - run: pnpm db:migrate
      - run: pnpm test
      - run: pnpm test:architecture
  e2e:
    name: e2e-smoke
    needs: [build, unit]
    if: needs.build.outputs.code == 'true'
    timeout-minutes: 4
    steps:
      - run: pnpm test:architecture
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
  ])('fires on a workflow where %s', (finding) => {
    expect(shapeFindings(BAD_WORKFLOW)).toContain(finding);
  });

  it('finds ci.yml in the shape its budgets need', () => {
    expect(shapeFindings(read('.github/workflows/ci.yml'))).toEqual([]);
  });
});
