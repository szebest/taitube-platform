import { extname } from 'node:path';
import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { read, trackedFiles } from './repo-files';

const TYPESCRIPT_SOURCES = [
  ':(glob)apps/**/*.ts',
  ':(glob)apps/**/*.tsx',
  ':(glob)packages/**/*.ts',
  ':(glob)packages/**/*.tsx',
  ':(glob)packages/**/*.mts',
  ':(glob)scripts/**/*.ts',
  ':(glob)tests/**/*.ts',
  // TanStack Start writes the router import into the generated tree with its extension.
  ':(exclude)apps/web/src/routeTree.gen.ts',
];

const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx']);
const CALLS_TAKING_A_MODULE = new Set(['import', 'require', 'mock']);

function calleeName(call: ts.CallExpression): string | undefined {
  if (call.expression.kind === ts.SyntaxKind.ImportKeyword) return 'import';
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
  return undefined;
}

function moduleSpecifier(node: ts.Node): string | undefined {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
    return ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
  }
  if (ts.isCallExpression(node) && CALLS_TAKING_A_MODULE.has(calleeName(node) ?? '')) {
    const [first] = node.arguments;
    if (first && ts.isStringLiteral(first)) return first.text;
  }
  return undefined;
}

/** A quoted relative path ending in an extension: without one, no import in the file can carry it. */
const RELATIVE_WITH_EXTENSION = /['"]\.\.?\/[^'"]*\.[cm]?[jt]sx?['"]/;

function extensioned(name: string, source: string): string[] {
  if (!RELATIVE_WITH_EXTENSION.test(source)) return [];
  const file = parseSource(name, source);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    const specifier = moduleSpecifier(node);
    if (specifier?.startsWith('.') && EXTENSIONS.has(extname(specifier))) found.push(specifier);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('architecture: extensionless relative imports', () => {
  it.each([
    ['an import', "import { ok } from './result.js';", './result.js'],
    ['a re-export', "export * from '../errors.mjs';", '../errors.mjs'],
    ['a dynamic import', "const lazy = await import('./lazy.ts');", './lazy.ts'],
    ['a vi.mock of a path', "vi.mock('./adapter.js', () => ({}));", './adapter.js'],
    ['a vi.mock of an import', "vi.mock(import('./adapter.js'));", './adapter.js'],
    ['a side-effect import', "import './side-effect.tsx';", './side-effect.tsx'],
  ])('fires on %s', (_name, source, specifier) => {
    expect(extensioned('fixture.ts', source)).toEqual([specifier]);
  });

  it('passes an extensionless relative import and a bare package specifier', () => {
    expect(
      extensioned('fixture.ts', "import { ok } from './result';\nimport { z } from 'zod.js';")
    ).toEqual([]);
  });

  it('finds no extension on a relative import in any tier, specs included', () => {
    const files = trackedFiles(...TYPESCRIPT_SOURCES);
    const offenders = files.flatMap((file) =>
      extensioned(file, read(file)).map((specifier) => `${file}: '${specifier}'`)
    );

    expect(files.length).toBeGreaterThan(500);
    expect(offenders).toEqual([]);
  });
});
