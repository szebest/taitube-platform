import { read, trackedFiles } from './repo-files';

/** `apps`, `packages` and `scripts`, without specs, `__tests__` or `__mocks__`. */
const PRODUCTION_SOURCE = [
  ':(glob)apps/**/*.ts',
  ':(glob)apps/**/*.tsx',
  ':(glob)packages/**/*.ts',
  ':(glob)packages/**/*.tsx',
  ':(glob)scripts/**/*.ts',
  ':(exclude,glob)**/*.test.ts',
  ':(exclude,glob)**/*.test.tsx',
  ':(exclude,glob)**/__tests__/**',
  ':(exclude,glob)**/__mocks__/**',
];

type Row = readonly [name: string, pattern: RegExp, scope: readonly string[], expected: number];

/** `scope` is a list of git pathspecs; `expected` counts matches across it, not files. */
const ROWS: readonly Row[] = [
  ['the hard-coded admin-token user id', /000000000003/g, PRODUCTION_SOURCE, 0],
  ['the dev seed in the migrate Job', /@vp\/db\/seed/g, ['apps/api/src/migrate.ts'], 0],
  ['a composition root defaulting its config', /\?\? inProcessAppConfig/g, PRODUCTION_SOURCE, 0],
];

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

  it('reads production source without specs, __tests__ or __mocks__', () => {
    const files = trackedFiles(...PRODUCTION_SOURCE);

    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((file) => /\.test\.tsx?$|__(tests|mocks)__/.test(file))).toEqual([]);
  });

  it.each(ROWS)('holds %s at the expected count', (_name, pattern, scope, expected) => {
    expect(countMatches(pattern, trackedFiles(...scope).map(read))).toBe(expected);
  });
});
