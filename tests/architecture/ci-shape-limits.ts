/**
 * Each job's budget in minutes, and the timeout that enforces it, by the check name GitHub reports;
 * a matrix job is keyed by its job key, one row for every app it runs.
 */
export const BUDGETS: Readonly<Record<string, number>> = {
  build: 2,
  'lint-typecheck': 3,
  unit: 4,
  'unit-bun': 6,
  integration: 3,
  'e2e-smoke': 4,
  'e2e-client': 4,
  visual: 4,
  terraform: 2,
};

export const CRITICAL_PATH_MINUTES = 8;

/** Keeps `main`'s cache entries younger than GitHub's 7-day eviction, so a PR has them to restore. */
export const WARM_CACHE_CRON = '0 4 * * 1,4';

export const BUDGET_ACTION = './.github/actions/budget';
export const JOB_START = 'JOB_STARTED_AT';

/** What `.github/actions/budget` holds, in seconds: the whole `unit` job and the architecture suite. */
export const SECOND_BUDGETS = [
  { job: 'unit', what: 'unit', seconds: 240 },
  { job: 'lint-typecheck', what: 'test:architecture', seconds: 10 },
];
export const WITH_SERVICES = new Set(['integration', 'e2e-smoke']);
/** Bun is a test runtime only: every script runs through `tsx`, so only `bun test` needs it. */
export const WITH_BUN = new Set(['unit-bun']);
/** What the `terraform` job runs against `infra/terraform`, with the provider plugins cached by the lock file. */
export const TERRAFORM_CHECKS = [
  /\bterraform -chdir=infra\/terraform fmt -check -recursive\b/,
  /\bterraform -chdir=infra\/terraform init -backend=false -input=false -lockfile=readonly\b/,
  /\bterraform -chdir=infra\/terraform validate\b/,
];
export const PROVIDER_CACHE_KEY = "hashFiles('infra/terraform/.terraform.lock.hcl')";
const DOCS = ['!**/*.md', '!docs/**/!(tokens.json)'];
/**
 * What a pull request must touch for a job to run, as a filter of the `build` job: everything but
 * the other tier's own directories, so a shared file (a lockfile, a root config, `universal`) runs
 * both. A push to main, a tag and the schedule run every job.
 */
export const AREA_FILTERS = {
  code: ['**', ...DOCS],
  server: ['**', '!apps/client/**', '!packages/client/**', ...DOCS],
  client: ['**', '!apps/server/**', '!packages/server/**', '!infra/terraform/**', ...DOCS],
  infra: ['infra/terraform/**', '.github/**'],
};
type Area = keyof typeof AREA_FILTERS;
/** The area whose output gates a job; every other job runs for any code change. */
export const JOB_AREA: Readonly<Record<string, Area>> = {
  'unit-bun': 'server',
  integration: 'server',
  e2e: 'server',
  visual: 'client',
  terraform: 'infra',
};
export const EVERY_EVENT = "github.event_name != 'pull_request'";
