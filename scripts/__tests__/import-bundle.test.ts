import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../import-bundle.ts');

function bundleOf(modules: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'import-bundle-'));
  for (const [file, source] of Object.entries(modules)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), source);
  }
  return dir;
}

describe('scripts: import-bundle', () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  it('passes a bundle whose every module loads, the chunks in a folder below included', () => {
    const dir = bundleOf({
      'server.js':
        "import { shared } from './assets/chunk.js'; console.log('booting'); export const handler = shared;",
      'assets/chunk.js': 'export const shared = 1;',
    });
    dirs.push(dir);

    const run = runEntrypoint(ENTRYPOINT, [dir], { PATH: process.env.PATH });

    expect(run.stdout).toBe(`2 modules in ${dir} load\n`);
    expect(run.status).toBe(0);
  });

  it.each([
    {
      failure: 'a require of a package the bundle does not hold',
      source:
        "import { createRequire } from 'node:module'; createRequire(import.meta.url)('react');",
      reported: "Cannot find module 'react'",
    },
    {
      failure: 'two imports of one name',
      source:
        "import { createRequire } from 'node:module'; import { createRequire } from 'node:module';",
      reported: "Identifier 'createRequire' has already been declared",
    },
  ])('fails on $failure, naming the module', ({ source, reported }) => {
    const dir = bundleOf({ 'server.js': 'export const handler = 1;', 'assets/upload.js': source });
    dirs.push(dir);

    const run = runEntrypoint(ENTRYPOINT, [dir], { PATH: process.env.PATH });

    expect(run.stderr).toContain(`1 of 2 modules in ${dir} do not load:\nassets/upload.js: `);
    expect(run.stderr).toContain(reported);
    expect(run.status).toBe(1);
  });
});
