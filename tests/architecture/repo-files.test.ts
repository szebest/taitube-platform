import { matchesGlob } from 'node:path';
import { trackedFiles } from './repo-files';

const TRACKED = trackedFiles();

describe('architecture: repo-files', () => {
  it.each(['**/*.test.ts', 'apps/**/*.tsx', 'packages/server/*/src/**', 'infra/**/*.{yml,yaml}'])(
    'lists what matchesGlob matches for %s',
    (glob) => {
      const expected = TRACKED.filter((file) => matchesGlob(file, glob));

      expect(expected).not.toEqual([]);
      expect(trackedFiles(`:(glob)${glob}`)).toEqual(expected);
    }
  );

  it('drops what an exclusion matches', () => {
    const files = trackedFiles(':(glob)apps/**/*.ts', ':(exclude,glob)apps/**/*.test.ts');

    expect(files).toContain('apps/api/src/main.ts');
    expect(files.filter((file) => file.endsWith('.test.ts'))).toEqual([]);
  });
});
