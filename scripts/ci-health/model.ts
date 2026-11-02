/** The fields of GitHub's REST `workflow_run`, `job` and `step` that ci:health reads, in GitHub's own shape. */
interface Step {
  name: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Job {
  id: number;
  run_attempt: number;
  name: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  steps: Step[];
}

export interface Run {
  id: number;
  run_attempt: number;
  head_sha: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  check_suite_id: number;
  jobs: Job[];
  /** Each test a job retried into a pass, by the annotation its reporter left. */
  retried: RetriedTest[];
}

export interface RetriedTest {
  job: string;
  /** `<spec path> > <test title>`, as the reporter wrote it. */
  test: string;
}

export type Outcome = 'success' | 'failure' | 'cancelled' | 'running';

export interface Merge {
  sha: string;
  pr: number;
  /** Commits main had that the PR's head did not when it merged: above 0, it landed behind main. */
  behindBy: number;
  lastPrRun: Outcome | 'none';
  mainRun: Outcome | 'none';
}

/** A run as the list of runs reports it, before its jobs and annotations are read. */
export type RunSummary = Omit<Run, 'jobs' | 'retried'>;
