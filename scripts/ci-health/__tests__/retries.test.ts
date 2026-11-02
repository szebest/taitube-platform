import { renderRetries, retries } from '../retries';
import { run } from './runs';

const SHORTS = 'apps/client/web/e2e/shorts.test.ts > arrow keys';
const RAIL = 'apps/client/web/src/a.dom.test.tsx > rail';

describe('retries', () => {
  const rows = retries([
    run({
      retried: [
        { job: 'e2e-web', test: SHORTS },
        { job: 'e2e-web', test: SHORTS },
      ],
    }),
    run({
      retried: [
        { job: 'e2e-web', test: SHORTS },
        { job: 'unit-shard-2', test: RAIL },
      ],
    }),
    run(),
  ]);

  it('counts each test once per run that retried it into a pass, most first', () => {
    expect(rows).toEqual([
      { test: SHORTS, runs: 2 },
      { test: RAIL, runs: 1 },
    ]);
  });

  it.each([
    { scenario: 'a retried test', input: rows, expected: `| ${SHORTS} | 2 |` },
    { scenario: 'none', input: [], expected: 'No test passed only on its retry.' },
  ])('renders $scenario', ({ input, expected }) => {
    expect(renderRetries(input)).toContain(expected);
  });
});
