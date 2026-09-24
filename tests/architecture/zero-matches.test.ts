import { read, trackedFiles } from './repo-files';
import { PRODUCTION_SOURCE, ROWS } from './zero-matches-rows';

function countMatches(pattern: RegExp, sources: readonly string[]): number {
  return sources.reduce((total, source) => total + (source.match(pattern)?.length ?? 0), 0);
}

describe('architecture: zero-matches', () => {
  it('counts every match, not every file', () => {
    expect(countMatches(/worker-\$\{process\.pid\}/g, ['`worker-${process.pid}`', 'none'])).toBe(1);
    expect(countMatches(/000000000003/g, ["'000000000003' '000000000003'", "'000000000003'"])).toBe(
      3
    );
  });

  it('reads the console row over entrypoints, scripts and the e2e runner too', () => {
    const consoleRow = ROWS.find((row) => row.name.startsWith('console'));
    const files = trackedFiles(...(consoleRow?.scope ?? []));

    expect(files).toContain('apps/api/src/main.ts');
    expect(files).toContain('tests/e2e/run-e2e.ts');
    expect(files).toContain('tests/e2e/e2e-runner.ts');
  });

  it('reads production source without specs, __tests__ or __mocks__', () => {
    const files = trackedFiles(...PRODUCTION_SOURCE);

    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((file) => /\.test\.tsx?$|__(tests|mocks)__/.test(file))).toEqual([]);
  });

  it.each(ROWS)('fires on its own fixture: $name', ({ pattern, fires }) => {
    expect(countMatches(pattern, [fires])).toBeGreaterThan(0);
  });

  it.each(ROWS)('holds $name at the expected count', ({ pattern, scope, expected }) => {
    const files = trackedFiles(...scope);

    expect(files.length).toBeGreaterThan(0);
    expect(countMatches(pattern, files.map(read))).toBe(expected);
  });
});
