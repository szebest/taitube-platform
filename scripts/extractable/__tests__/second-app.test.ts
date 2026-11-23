import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { overrideProblems, productValues, tarballOf } from '../second-app';

let appRoot = '';

function install(entry: string, files: Record<string, string>): void {
  const dir = join(appRoot, 'node_modules/.pnpm', entry, 'node_modules/@kit/x');
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

beforeEach(() => {
  appRoot = mkdtempSync(join(tmpdir(), 'extractable-spec-app-'));
  mkdirSync(join(appRoot, 'node_modules/.pnpm'), { recursive: true });
});

afterEach(() => {
  rmSync(appRoot, { recursive: true, force: true });
});

describe('scripts: extractable second app', () => {
  it('names the tarball of a scoped package without its version', () => {
    expect(tarballOf('@kit/design-tokens')).toBe('file:tarballs/kit-design-tokens.tgz');
  });

  it('asks for an override of each package the app reaches, and the drop of each it no longer does', () => {
    const overrides = {
      '@kit/di': tarballOf('@kit/di'),
      '@kit/errors': 'file:tarballs/errors.tgz',
      '@kit/gone': tarballOf('@kit/gone'),
      vite: 'npm:other',
    };

    expect(overrideProblems(overrides, ['@kit/di', '@kit/errors', '@kit/result'])).toEqual([
      'tests/fixtures/second-app/pnpm-workspace.yaml: override @kit/errors with file:tarballs/kit-errors.tgz',
      'tests/fixtures/second-app/pnpm-workspace.yaml: override @kit/result with file:tarballs/kit-result.tgz',
      'tests/fixtures/second-app/pnpm-workspace.yaml: drop the override of @kit/gone, which the app no longer reaches',
    ]);
  });

  it('names a product value planted in an installed package, its source map included', () => {
    install('@kit+x@file+tarballs+kit-x.tgz', {
      'dist/index.js': 'export const issuer = "acme";\n',
      'dist/index.js.map': '{"sourcesContent":["const prefix = \'taitube.look\';"]}',
    });

    expect(productValues(appRoot, ['@kit/x'])).toEqual([
      `@kit+x@file+tarballs+kit-x.tgz/node_modules/@kit/x/dist/index.js.map:1: holds a value of this product: {"sourcesContent":["const prefix = 'taitube.look';"]}`,
    ]);
  });

  it('fails when it scanned nothing, and names each closure package it did not scan', () => {
    expect(productValues(appRoot, ['@kit/x'])).toEqual([
      `@kit/x is not installed in ${join(appRoot, 'node_modules/.pnpm')}, so nothing of it was scanned`,
      `no shipped file under ${join(appRoot, 'node_modules/.pnpm')}/@kit+*`,
    ]);
  });

  it('names a closure package missing beside one it scanned', () => {
    install('@kit+x@file+tarballs+kit-x.tgz', { 'dist/index.js': 'export {};\n' });

    expect(productValues(appRoot, ['@kit/x', '@kit/y'])).toEqual([
      `@kit/y is not installed in ${join(appRoot, 'node_modules/.pnpm')}, so nothing of it was scanned`,
    ]);
  });
});
