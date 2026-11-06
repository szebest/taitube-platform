import { basename, dirname } from 'node:path';
import { isSpec, productionSources, read, trackedFiles } from './repo-files';
import { hasRuntimeCode } from './runtime-code';

const SPEC_SUFFIXES = ['test.ts', 'test.tsx', 'dom.test.ts', 'dom.test.tsx'];

/**
 * The parts a component splits out beside it, which its own spec covers (`button.variants.ts`,
 * `constants.ts`): by the part's own stem, or else by the folder's name.
 */
const COMPONENT_PARTS = /(?:\.(?:variants|context)|^constants)$/;

function siblingSpecs(file: string): string[] {
  const stem = basename(file).replace(/\.tsx?$/, '');
  const names = COMPONENT_PARTS.test(stem)
    ? [stem, stem.replace(COMPONENT_PARTS, ''), basename(dirname(file))]
    : [stem];
  return [...new Set(names.filter(Boolean))].flatMap((name) =>
    SPEC_SUFFIXES.map((suffix) => `${dirname(file)}/__tests__/${name}.${suffix}`)
  );
}

function coveredSources(): string[] {
  return productionSources().filter(
    (file) =>
      basename(file) !== 'index.ts' &&
      !file.endsWith('.config.ts') &&
      !file.endsWith('.setup.ts') &&
      !/\.lazy\.tsx?$/.test(file) &&
      !file.includes('/.storybook/')
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

  it.each([
    { source: 'src/button.tsx', spec: 'src/__tests__/button.dom.test.tsx' },
    { source: 'src/button.variants.ts', spec: 'src/__tests__/button.dom.test.tsx' },
    { source: 'src/card.context.ts', spec: 'src/__tests__/card.dom.test.tsx' },
    { source: 'src/resolve.ts', spec: 'src/__tests__/resolve.test.ts' },
    {
      source: 'src/components/video-card/video-card.tsx',
      spec: 'src/components/video-card/__tests__/video-card.dom.test.tsx',
    },
    { source: 'src/hooks/use-x.ts', spec: 'src/hooks/__tests__/use-x.test.ts' },
    {
      source: 'src/video-card/constants.ts',
      spec: 'src/video-card/__tests__/video-card.dom.test.tsx',
    },
    {
      source: 'src/session-provider/session.context.ts',
      spec: 'src/session-provider/__tests__/session-provider.dom.test.tsx',
    },
    {
      source: 'src/routes/-components/watch-page/watch-page.tsx',
      spec: 'src/routes/-components/watch-page/__tests__/watch-page.dom.test.tsx',
    },
  ])('looks for $source spec at $spec', ({ source, spec }) => {
    expect(siblingSpecs(source)).toContain(spec);
  });

  it('asks a dotted file that is not a component part for its own spec', () => {
    expect(siblingSpecs('src/foo.helpers.ts')).not.toContain('src/__tests__/foo.test.ts');
  });

  it('still matches the sources that already carry a spec', () => {
    expect(coveredSources().length - uncovered.length).toBeGreaterThan(100);
  });

  it('gives every production source a name-matching spec beside it', () => {
    expect(uncovered).toEqual([]);
  });
});
