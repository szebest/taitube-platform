import { basename, dirname } from 'node:path';
import { isSpec, productionSources, read, trackedFiles } from './repo-files';
import { hasRuntimeCode } from './runtime-code';

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
  return coveredSources()
    .filter((file) => !siblingSpecs(file).some((spec) => specs.has(spec)))
    .filter((file) => hasRuntimeCode(file, read(file)));
}

describe('architecture: one test file per source file', () => {
  const uncovered = untested();

  it.each([
    { scenario: 'an interface', source: 'export interface Port { read(): Promise<void>; }' },
    { scenario: 'a type alias', source: "export type Kind = 'a' | 'b';" },
    { scenario: 'a declared constant', source: 'export declare const LIMIT: number;' },
    {
      scenario: 'a function signature',
      source: 'export declare function twice(n: number): number;',
    },
    {
      scenario: 'an abstract class of abstract members',
      source:
        "import { Base } from './base';\nexport abstract class Port extends Base {\n  abstract read(): void;\n}",
    },
    {
      scenario: 'a documented abstract class of abstract members',
      source:
        '/** The verdict. */\nexport abstract class Port {\n  /** Reads. */\n  abstract read(): void;\n}',
    },
  ])('asks no spec of $scenario, which erases to nothing', ({ source }) => {
    expect(hasRuntimeCode('fixture.ts', source)).toBe(false);
  });

  it.each([
    { scenario: 'a constant', source: 'export const LIMIT = 3;' },
    { scenario: 'a function', source: 'export function twice(n: number) { return n * 2; }' },
    {
      scenario: 'an abstract class with a concrete method',
      source: 'export abstract class Port { abstract read(): void; name() { return "port"; } }',
    },
  ])('still asks a spec of $scenario', ({ source }) => {
    expect(hasRuntimeCode('fixture.ts', source)).toBe(true);
  });

  it('still matches the sources that already carry a spec', () => {
    expect(coveredSources().length - uncovered.length).toBeGreaterThan(100);
  });

  it('gives every production source a name-matching spec beside it', () => {
    expect(uncovered).toEqual([]);
  });
});
