import { productionSources, read } from './repo-files';

const PACKAGE = 'packages/universal/validation/';
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/**
 * "Input only" is not a sentence in a document: a rule that can reach an entity type is a rule that
 * will, and the split between `@vp/validation` and `@vp/domain-rules` is what makes wire safety a
 * type rather than a per-field judgement.
 */
const FORBIDDEN = /^@vp\/(domain|core)(\/.*)?$/;

function sources(): string[] {
  return productionSources().filter((file) => file.startsWith(PACKAGE));
}

function imports(file: string): string[] {
  return [...read(file).matchAll(SPECIFIER)].map((match) => match[1] as string);
}

describe('architecture: @vp/validation takes input and nothing else', () => {
  it('reads the package it is asserting about', () => {
    expect(sources().length).toBeGreaterThan(5);
  });

  it('imports no entity vocabulary in any source file', () => {
    const offenders = sources().flatMap((file) =>
      imports(file)
        .filter((specifier) => FORBIDDEN.test(specifier))
        .map((specifier) => `${file}: '${specifier}'`)
    );

    expect(offenders).toEqual([]);
  });

  it('declares no entity package in its manifest either', () => {
    const manifest = JSON.parse(read(`${PACKAGE}package.json`)) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];

    expect(declared.filter((name) => FORBIDDEN.test(name))).toEqual([]);
  });

  it('keeps @vp/domain-rules free to import them, which is what makes the split meaningful', () => {
    const manifest = JSON.parse(read('packages/universal/domain-rules/package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(Object.keys(manifest.dependencies ?? {})).toContain('@vp/domain');
  });
});
