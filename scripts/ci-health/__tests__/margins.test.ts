import { budgetsOf, margins, measured, renderMargins } from '../margins';
import { at, job, run } from './runs';

const WORKFLOW = `
jobs:
  unit-shards:
    name: unit-shard-\${{ matrix.shard }}
    timeout-minutes: 4
    steps:
      - id: unit-tests
        name: Run unit tests (Node 24)
        run: pnpm test:unit
      - uses: ./.github/actions/budget
        with:
          step: unit-tests
          seconds: 100
  publish:
    uses: ./.github/workflows/images.yml
`;

const shard = (name: string, testSeconds: number, conclusion = 'success') =>
  job(name, {
    conclusion,
    started_at: at(0),
    completed_at: at(testSeconds + 30),
    steps: [
      {
        name: 'Run unit tests (Node 24)',
        conclusion,
        started_at: at(20),
        completed_at: at(20 + testSeconds),
      },
    ],
  });

const runs = [
  run({ jobs: [shard('unit-shard-1', 50), shard('unit-shard-2', 90)] }),
  run({ jobs: [shard('unit-shard-1', 86), shard('unit-shard-2', 120, 'failure')] }),
];

describe('budgetsOf', () => {
  const budgets = budgetsOf(WORKFLOW);

  it('reads a job timeout and a step budget, by the names GitHub reports', () => {
    expect(budgets.map(({ label, step, seconds }) => ({ label, step, seconds }))).toEqual([
      { label: 'unit-shard-*', step: undefined, seconds: 240 },
      {
        label: 'unit-shard-* / Run unit tests (Node 24)',
        step: 'Run unit tests (Node 24)',
        seconds: 100,
      },
    ]);
  });

  it.each([
    ['unit-shard-6', true],
    ['unit-bun-shard-1', false],
  ])('matches %s to the matrix job: %s', (name, matches) => {
    expect(budgets[0]?.job.test(name)).toBe(matches);
  });
});

describe('margins', () => {
  const expected: Record<string, number[]> = {
    'unit-shard-*': [80, 120, 116],
    'unit-shard-* / Run unit tests (Node 24)': [50, 90, 86],
  };

  it.each(budgetsOf(WORKFLOW))('measures the successful runs of $label', (budget) => {
    expect(measured(runs, budget)).toEqual(expected[budget.label]);
  });

  it('counts the runs inside 15% and 10% of the limit, and over it', () => {
    expect(margins(runs, budgetsOf(WORKFLOW))[1]).toMatchObject({
      runs: 3,
      max: 90,
      near85: 2,
      near90: 1,
      over: 0,
    });
  });

  it('renders a row per budget', () => {
    expect(renderMargins(margins(runs, budgetsOf(WORKFLOW)))).toContain(
      '| unit-shard-* / Run unit tests (Node 24) | 3 | 86 | 90 | 90 | 100 | 2 | 1 | 0 |'
    );
  });
});
