interface Step {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

export interface Job {
  name?: string;
  needs?: string | string[];
  strategy?: { matrix?: Record<string, readonly (string | number)[]> };
  if?: string;
  'timeout-minutes'?: number;
  services?: Record<string, unknown>;
  steps?: Step[];
  uses?: string;
}

interface PullRequestTrigger {
  branches?: string[];
  'branches-ignore'?: string[];
}

export interface Triggers {
  pull_request?: PullRequestTrigger | null;
  schedule?: { cron?: string }[];
}

export interface Workflow {
  /** GitHub takes one event name, a list of them, or a map of each event to its filters. */
  on?: string | string[] | Triggers;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean | string };
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
}

export function triggersOf(workflow: Workflow): Triggers {
  const { on } = workflow;
  if (on === undefined) return {};
  if (typeof on === 'string' || Array.isArray(on)) {
    return Object.fromEntries([on].flat().map((event) => [event, null]));
  }
  return on;
}

export function needsOf(job: Job): string[] {
  if (job.needs === undefined) return [];
  if (typeof job.needs === 'string') return [job.needs];
  return job.needs;
}

export const runs = (job: Job): string =>
  (job.steps ?? []).map((step) => step.run ?? '').join('\n');

export interface Check {
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
export function checks(workflow: Workflow): Check[] {
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
