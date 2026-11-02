import { type Exec, gitHub, mapLimit } from '../github';

const RUN = {
  id: 7,
  run_attempt: 1,
  head_sha: 'a1',
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'failure',
  created_at: '2026-10-31T12:00:00Z',
};
const JOB = {
  id: 70,
  run_attempt: 1,
  name: 'unit-shard-1',
  conclusion: 'failure',
  started_at: '2026-10-31T12:00:00Z',
  completed_at: '2026-10-31T12:03:00Z',
  steps: [],
};

/** Answers each `gh api` path by the first route it starts with, as `gh --jq` prints: a value per line, a string raw. */
function fakeGh(routes: Record<string, unknown[]>): { exec: Exec; paths: string[] } {
  const paths: string[] = [];
  const exec: Exec = async (args) => {
    const path = args.at(-1) ?? '';
    paths.push(path);
    const route = Object.keys(routes).find((prefix) => path.includes(prefix));
    return (routes[route ?? ''] ?? [])
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join('\n');
  };
  return { exec, paths };
}

describe('mapLimit', () => {
  it('keeps the order of its input', async () => {
    const doubled = await mapLimit([3, 1, 2], 2, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value));
      return value * 2;
    });

    expect(doubled).toEqual([6, 2, 4]);
  });
});

describe('gitHub', () => {
  it.each([
    { branch: 'main', filter: '&branch=main&event=push' },
    { branch: 'pr', filter: '&event=pull_request' },
  ] as const)(
    'lists the $branch runs with every job of every attempt',
    async ({ branch, filter }) => {
      const { exec, paths } = fakeGh({ '/runs?': [RUN], '/runs/7/jobs': [JOB] });

      const runs = await gitHub(exec).runs({ branch, runs: 50, created: '2026-10-30..2026-10-31' });

      expect(runs).toEqual([{ ...RUN, jobs: [JOB] }]);
      expect(paths[0]).toBe(
        `repos/{owner}/{repo}/actions/workflows/ci.yml/runs?per_page=100&page=1${filter}&created=2026-10-30..2026-10-31`
      );
    }
  );

  it('reads a merge: its PR head, how far behind main it was, the PR run and main first time', async () => {
    const { exec } = fakeGh({
      'commits?sha=main': [
        { sha: 'm2', parent: 'm1', subject: '77: Platform integrations (#273)' },
        { sha: 'm1', parent: 'm0', subject: 'a direct push' },
      ],
      'pulls/273': ['h1'],
      'compare/m1...h1': [1],
      'head_sha=h1': [{ ...RUN, conclusion: 'success' }],
      'head_sha=m2': [RUN],
      '/runs/7/jobs': [JOB],
    });

    expect(await gitHub(exec).merges(20)).toEqual([
      { sha: 'm2', pr: 273, behindBy: 1, lastPrRun: 'success', mainRun: 'failure' },
    ]);
  });
});
