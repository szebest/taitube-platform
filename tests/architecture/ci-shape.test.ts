import { shapeFindings } from './ci-shape-rules';
import { read } from './repo-files';

const BAD_WORKFLOW = `
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 4 1 * *'
concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
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
    'a pull request into a branch other than main gets no CI',
    "main's caches are not kept warm by the 0 4 * * 1,4 schedule",
    'a scheduled run can cancel the run of a push to main',
    'lint-typecheck: test:architecture is not held to 8 s',
    'unit: its budget does not run from the first step to the last',
    'unit: sets up Bun',
    'unit-bun: does not set up Bun',
    'terraform: does not check fmt, init and validate',
    'terraform: no provider cache keyed by the lock file',
  ])('fires on a workflow where %s', (finding) => {
    expect(shapeFindings(BAD_WORKFLOW)).toContain(finding);
  });

  it.each([
    { on: 'push', fires: true },
    { on: '[push, schedule]', fires: true },
    { on: 'pull_request', fires: false },
    { on: '[pull_request]', fires: false },
    { on: '[push, pull_request]', fires: false },
  ])('reads on: $on as a pull request trigger unless fires is $fires', ({ on, fires }) => {
    const findings = shapeFindings(`on: ${on}\njobs: {}\n`);

    expect(findings.includes('a pull request gets no CI')).toBe(fires);
  });

  it('finds ci.yml in the shape its budgets need', () => {
    expect(shapeFindings(read('.github/workflows/ci.yml'))).toEqual([]);
  });
});
