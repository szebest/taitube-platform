import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const BROWSER_TIERS = ['universal', 'client'];
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g;

async function browserTierSources(): Promise<string[]> {
  const files: string[] = [];
  for (const tier of BROWSER_TIERS) {
    for await (const entry of glob(`packages/${tier}/*/src/**/*.ts`, { cwd: ROOT })) {
      if (!entry.includes('__tests__') && !entry.endsWith('.test.ts')) files.push(entry);
    }
  }
  return files;
}

describe('architecture: ESM specifiers in browser-bound packages', () => {
  it('gives every relative import an explicit extension', async () => {
    const offenders: string[] = [];

    for (const file of await browserTierSources()) {
      const source = readFileSync(join(ROOT, file), 'utf8');
      for (const match of source.matchAll(RELATIVE_IMPORT)) {
        const specifier = match[1] as string;
        if (extname(specifier) === '') offenders.push(`${file}: '${specifier}'`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
