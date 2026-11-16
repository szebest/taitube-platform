import { isDeepStrictEqual } from 'node:util';
import { load } from 'js-yaml';
import { budgetFindings } from './ci-budget-rules';
import { checks, type Job, needsOf, runs, triggersOf, type Workflow } from './ci-workflow';

const matrixShards = (job: Job): string | (string | number)[] => {
  const shards = job.strategy?.matrix?.shard ?? [];
  return typeof shards === 'string' ? shards : [...shards];
};

const rangeTo = (count: number): number[] => Array.from({ length: count }, (_, index) => index + 1);

/** build 3, a unit shard 5 and the aggregate 1: the longest chain of timeouts. */
const CRITICAL_PATH_MINUTES = 9;

/** Keeps `main`'s cache entries younger than GitHub's 7-day eviction, so a PR has them to restore. */
const WARM_CACHE_CRON = '0 4 * * 1,4';

/** A commit on main whose run was cancelled was never fully checked. */
const PULL_REQUESTS_ONLY = "${{ github.event_name == 'pull_request' }}";

const WITH_SERVICES = new Set(['integration', 'e2e-smoke']);
/** Bun is a test runtime only: every script runs through `tsx`, so only `bun test` needs it. */
const WITH_BUN = new Set(['unit-bun-shards']);
/** What the `terraform` job runs against `infra/terraform`, with the provider plugins cached by the lock file. */
const TERRAFORM_CHECKS = [
  /\bterraform -chdir=infra\/terraform fmt -check -recursive\b/,
  /\bterraform -chdir=infra\/terraform init -backend=false -input=false -lockfile=readonly\b/,
  /\bterraform -chdir=infra\/terraform validate\b/,
];
const PROVIDER_CACHE_KEY = "hashFiles('infra/terraform/.terraform.lock.hcl')";
const DOCS_ONLY_FILTER = { code: ['**', '!**/*.md', '!docs/**/!(tokens.json)'] };

const PLANS_SHARDS = /\bpnpm (?:-s )?unit-shards --github-output\b/;
const PLANNED_MATRIX =
  /^\$\{\{\s*fromJSON\(needs\.build\.outputs\.([\w-]+)(?:\s*\|\|[^)]*)?\)\s*\}\}$/;
const PLANNED_COUNT = /^\$\{\{\s*needs\.build\.outputs\.([\w-]+)\s*\}\}$/;

/** The scripts that run `pnpm boundaries` themselves, as `package.json` defines them. */
const RUNS_BOUNDARIES = /\bpnpm (boundaries|build|typecheck)\b/g;

const setsUpBun = (job: Job): boolean =>
  (job.steps ?? []).some(
    (step) => step.uses?.startsWith('oven-sh/setup-bun@') || step.with?.bun === 'true'
  );

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
  if (workflow.concurrency?.['cancel-in-progress'] !== PULL_REQUESTS_ONLY) {
    findings.push('a push to main can cancel the run of the merge before it');
  }

  if (workflow.permissions?.packages === 'write') {
    findings.push('the workflow grants packages: write to every job');
  }

  findings.push(...budgetFindings(workflow, jobs));

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

  if (!/\bpnpm gen:tokens --check\b/.test(runs(jobNamed('lint-typecheck') ?? {}))) {
    findings.push(
      'lint-typecheck: tokens.json and the generated stylesheets are not checked for drift'
    );
  }

  if (!/\bpnpm gen:env-docs --check\b/.test(runs(jobNamed('lint-typecheck') ?? {}))) {
    findings.push('lint-typecheck: docs/ENVIRONMENT.md is not checked for drift');
  }

  if (!/\bpnpm gen:state-machines --check\b/.test(runs(jobNamed('lint-typecheck') ?? {}))) {
    findings.push('lint-typecheck: docs/state-machines.md is not checked for drift');
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
    if (setsUpBun(job) && !WITH_BUN.has(key)) findings.push(`${name}: sets up Bun`);
    if (!setsUpBun(job) && WITH_BUN.has(key)) findings.push(`${name}: does not set up Bun`);

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

  const build = jobNamed('build');
  const planned = (build?.steps ?? []).some((step) => PLANS_SHARDS.test(step.run ?? ''));
  for (const [key, job] of Object.entries(workflow.jobs)) {
    const shards = matrixShards(job);
    const divisor = /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/(\d+|\$\{\{[^}]*\}\})/.exec(
      runs(job)
    )?.[1];
    if (divisor === undefined) continue;
    if (/^\d+$/.test(divisor)) {
      if (!isDeepStrictEqual(shards, rangeTo(Number(divisor)))) {
        findings.push(`${key}: its matrix does not run every one of the ${divisor} shards`);
      }
      continue;
    }
    const matrixOutput = typeof shards === 'string' ? PLANNED_MATRIX.exec(shards)?.[1] : undefined;
    const countOutput = PLANNED_COUNT.exec(divisor)?.[1];
    if (
      !planned ||
      matrixOutput === undefined ||
      countOutput === undefined ||
      !build?.outputs?.[matrixOutput] ||
      !build.outputs[countOutput]
    ) {
      findings.push(
        `${key}: its matrix and --shard denominator are not the outputs of pnpm unit-shards in build`
      );
    }
  }

  const filter = (jobNamed('build')?.steps ?? []).find((step) =>
    step.uses?.startsWith('dorny/paths-filter@')
  );
  const filters = filter?.with?.filters;
  if (
    !isDeepStrictEqual(typeof filters === 'string' ? load(filters) : undefined, DOCS_ONLY_FILTER)
  ) {
    findings.push('build: no path filter that skips a docs-only change');
  }
  if (filter?.with?.['predicate-quantifier'] !== 'every') {
    findings.push('build: the path filter matches a file on any one pattern');
  }

  return findings;
}

/** The guide warns that setup-vp's `v1` tag no longer moves, so only a commit SHA pins it. */
const SETUP_VP_PINNED = /^voidzero-dev\/setup-vp@[0-9a-f]{40}$/;

interface CompositeAction {
  runs?: { steps?: { uses?: string; with?: Record<string, string> }[] };
}

export function setupWorkspaceFindings(source: string): string[] {
  const steps = (load(source) as CompositeAction).runs?.steps ?? [];
  const setupVp = steps.find((step) => step.uses?.startsWith('voidzero-dev/setup-vp@'));
  const findings: string[] = [];
  if (!setupVp) return ['setup-workspace: does not set up Vite+ through setup-vp'];
  if (!SETUP_VP_PINNED.test(setupVp.uses ?? ''))
    findings.push('setup-workspace: setup-vp is not pinned by commit SHA');
  if (setupVp.with?.['node-version-file'] !== '.nvmrc')
    findings.push('setup-workspace: Node.js does not come from .nvmrc');
  if (steps.some((step) => /^(pnpm\/setup|actions\/setup-node)@/.test(step.uses ?? '')))
    findings.push('setup-workspace: sets up Node.js or pnpm beside setup-vp');
  return findings;
}
