import { dirname, basename } from 'node:path';
import { UNTESTED_SOURCES } from './untested-sources';
import { isSpec, productionSources, shrinkOnly, trackedFiles } from './repo-files';

function siblingSpecs(file: string): string[] {
  const stem = basename(file).replace(/\.tsx?$/, '');
  return ['ts', 'tsx'].map((ext) => `${dirname(file)}/__tests__/${stem}.test.${ext}`);
}

function coveredSources(): string[] {
  return productionSources().filter(
    (file) => basename(file) !== 'index.ts' && !file.endsWith('.config.ts')
  );
}

function untested(): string[] {
  const specs = new Set(trackedFiles('apps', 'packages', 'scripts').filter(isSpec));
  return coveredSources().filter((file) => !siblingSpecs(file).some((spec) => specs.has(spec)));
}

describe('architecture: one test file per source file', () => {
  it('still matches the sources that already carry a spec', () => {
    expect(coveredSources().length - untested().length).toBeGreaterThan(100);
  });

  it('gives every production source a name-matching spec beside it', () => {
    const { unlisted } = shrinkOnly(untested(), UNTESTED_SOURCES);

    expect(unlisted).toEqual([]);
  });

  it('keeps the exception list shrinking: no entry that already has a spec', () => {
    const { stale } = shrinkOnly(untested(), UNTESTED_SOURCES);

    expect(stale).toEqual([]);
  });
});
