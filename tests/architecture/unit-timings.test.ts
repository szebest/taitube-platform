import { execFileSync } from 'node:child_process';
import { isSpec, ROOT, read, trackedFiles } from './repo-files';

const TIMINGS = 'tests/timings/unit.json';
const GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Specs `pnpm test:unit` never runs: the architecture suite, the browser suites and the integration specs. */
const NOT_UNIT = [
  /^tests\/(architecture|e2e|integration|browser|load|playwright)\//,
  /^apps\/client\/[^/]+\/e2e\//,
  /\/__tests__\/integration\//,
  /^packages\/client\/workbench\/visual\/[^/]+\.test\.ts$/,
];

const unitSpecs = (): string[] =>
  trackedFiles('apps', 'packages', 'scripts', 'tests')
    .filter(isSpec)
    .filter((file) => !NOT_UNIT.some((pattern) => pattern.test(file)));

const addedAt = (file: string): number =>
  Date.parse(
    execFileSync('git', ['log', '--diff-filter=A', '--format=%cI', '-1', '--', file], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim() || new Date().toISOString()
  );

/** The spec files the timing file has gone without for longer than the grace period. */
function overdue(
  specs: readonly string[],
  timed: ReadonlySet<string>,
  added: (file: string) => number,
  now: number
): string[] {
  return specs.filter((file) => !timed.has(file) && now - added(file) > GRACE_DAYS * DAY_MS);
}

describe(`architecture: ${TIMINGS} times every unit spec file`, () => {
  const now = Date.parse('2026-11-02T12:00:00Z');

  it.each([
    { scenario: 'an untimed spec added 8 days ago', days: 8, timed: false, fires: true },
    { scenario: 'an untimed spec added 6 days ago', days: 6, timed: false, fires: false },
    { scenario: 'a timed spec added 30 days ago', days: 30, timed: true, fires: false },
  ])('fires on $scenario: $fires', ({ days, timed, fires }) => {
    const file = 'apps/server/api/src/__tests__/fixture.test.ts';
    const found = overdue([file], new Set(timed ? [file] : []), () => now - days * DAY_MS, now);

    expect(found.length > 0).toBe(fires);
  });

  it(`lists every unit spec file older than ${GRACE_DAYS} days (pnpm timings:update)`, () => {
    const timed = new Set(Object.keys(JSON.parse(read(TIMINGS)) as object));

    expect(overdue(unitSpecs(), timed, addedAt, Date.now())).toEqual([]);
  });
});
