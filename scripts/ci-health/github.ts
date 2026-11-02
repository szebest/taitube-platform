import { attemptOutcome, finalOutcome } from './first-time';
import type { Job, Merge, Run } from './model';

export type Exec = (args: string[]) => Promise<string>;

export type Branch = 'main' | 'pr' | 'all';

export interface Window {
  branch: Branch;
  runs: number;
  /** GitHub's `created` filter, `2026-10-30T14:27:00Z..2026-10-31T13:05:00Z`. */
  created?: string;
}

const RUNS = 'repos/{owner}/{repo}/actions/workflows/ci.yml/runs';
const PAGE = 100;
const RUN_FIELDS =
  '{id, run_attempt, head_sha, head_branch, event, status, conclusion, created_at}';
const JOB_FIELDS =
  '{id, run_attempt, name, conclusion, started_at, completed_at, steps: [.steps[] | {name, conclusion, started_at, completed_at}]}';

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  each: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await each(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const lines = <T>(text: string): T[] =>
  text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

const BRANCH_FILTERS: Record<Branch, string> = {
  main: '&branch=main&event=push',
  pr: '&event=pull_request',
  all: '',
};

export function gitHub(exec: Exec) {
  const api = (path: string, jq?: string, paginate = false) =>
    exec(['api', ...(paginate ? ['--paginate'] : []), ...(jq ? ['--jq', jq] : []), path]);

  const jobs = async (runId: number): Promise<Job[]> =>
    lines<Job>(
      await api(
        `repos/{owner}/{repo}/actions/runs/${runId}/jobs?filter=all&per_page=${PAGE}`,
        `.jobs[] | ${JOB_FIELDS}`,
        true
      )
    );

  async function listRuns(window: Window): Promise<Omit<Run, 'jobs'>[]> {
    const created = window.created ? `&created=${encodeURIComponent(window.created)}` : '';
    const listed: Omit<Run, 'jobs'>[] = [];
    for (let page = 1; listed.length < window.runs; page += 1) {
      const query = `?per_page=${PAGE}&page=${page}${BRANCH_FILTERS[window.branch]}${created}`;
      const found = lines<Omit<Run, 'jobs'>>(
        await api(`${RUNS}${query}`, `.workflow_runs[] | ${RUN_FIELDS}`)
      );
      listed.push(...found);
      if (found.length < PAGE) break;
    }
    return listed.slice(0, window.runs);
  }

  async function runs(window: Window): Promise<Run[]> {
    return mapLimit(await listRuns(window), 8, async (run) => ({
      ...run,
      jobs: await jobs(run.id),
    }));
  }

  const log = (jobId: number): Promise<string> =>
    api(`repos/{owner}/{repo}/actions/jobs/${jobId}/logs`);

  async function merge(sha: string, parent: string, pr: number): Promise<Merge> {
    const head = (await api(`repos/{owner}/{repo}/pulls/${pr}`, '.head.sha')).trim();
    const behindBy = Number(
      await api(`repos/{owner}/{repo}/compare/${parent}...${head}`, '.behind_by')
    );
    const [prRun] = lines<Omit<Run, 'jobs'>>(
      await api(
        `${RUNS}?head_sha=${head}&event=pull_request&per_page=1`,
        `.workflow_runs[] | ${RUN_FIELDS}`
      )
    );
    const [mainRun] = lines<Omit<Run, 'jobs'>>(
      await api(
        `${RUNS}?head_sha=${sha}&branch=main&event=push&per_page=1`,
        `.workflow_runs[] | ${RUN_FIELDS}`
      )
    );
    return {
      sha,
      pr,
      behindBy,
      lastPrRun: prRun ? finalOutcome(prRun) : 'none',
      mainRun: mainRun ? attemptOutcome({ ...mainRun, jobs: await jobs(mainRun.id) }) : 'none',
    };
  }

  async function merges(count: number): Promise<Merge[]> {
    const commits = lines<{ sha: string; parent: string; subject: string }>(
      await api(
        `repos/{owner}/{repo}/commits?sha=main&per_page=${PAGE}`,
        '.[] | {sha, parent: .parents[0].sha, subject: (.commit.message | split("\\n")[0])}'
      )
    );
    const merged = commits
      .map((commit) => ({ ...commit, pr: Number(/\(#(\d+)\)$/.exec(commit.subject)?.[1]) }))
      .filter((commit) => Number.isInteger(commit.pr))
      .slice(0, count);
    return mapLimit(merged, 4, ({ sha, parent, pr }) => merge(sha, parent, pr));
  }

  return { runs, log, merges };
}
