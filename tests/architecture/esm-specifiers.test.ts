import { read, trackedFiles } from './repo-files';

const TYPESCRIPT_SOURCES = [
  ':(glob)apps/**/*.ts',
  ':(glob)apps/**/*.tsx',
  ':(glob)packages/**/*.ts',
  ':(glob)packages/**/*.tsx',
  ':(glob)packages/**/*.mts',
  ':(glob)scripts/**/*.ts',
  ':(glob)tests/**/*.ts',
];

const RELATIVE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.mock\s*\(\s*)['"](\.{1,2}\/[^'"]*)['"]/g;
const EXTENSION = /\.(?:[cm]?js|[cm]?ts|tsx|jsx)$/;

function extensioned(source: string): string[] {
  return [...source.matchAll(RELATIVE_SPECIFIER)]
    .map((match) => match[1] as string)
    .filter((specifier) => EXTENSION.test(specifier));
}

describe('architecture: extensionless relative imports', () => {
  it.each([
    ['import { ok } from ', './result', '.js', ';'],
    ['export * from ', '../errors', '.mjs', ';'],
    ['const lazy = await import(', './lazy', '.ts', ');'],
    ['vi.mock(', './adapter', '.js', ', () => ({}));'],
    ['import ', './side-effect', '.tsx', ';'],
  ])('fires on %s%s%s', (head, path, extension, tail) => {
    expect(extensioned(`${head}'${path}${extension}'${tail}`)).toEqual([`${path}${extension}`]);
  });

  it('passes an extensionless relative import and a bare package specifier', () => {
    expect(extensioned("import { ok } from './result';\nimport { z } from 'zod';")).toEqual([]);
  });

  it('finds no extension on a relative import in any tier, specs included', () => {
    const files = trackedFiles(...TYPESCRIPT_SOURCES);
    const offenders = files.flatMap((file) =>
      extensioned(read(file)).map((specifier) => `${file}: '${specifier}'`)
    );

    expect(files.length).toBeGreaterThan(500);
    expect(offenders).toEqual([]);
  });
});
