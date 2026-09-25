import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sourceAliases } from './workspace-sources';

const HERE = import.meta.dirname;

/** Every `import ts from 'typescript'` in the suite, pointed at the `require` in `typescript.ts`. */
export const ALIASES = [
  ...sourceAliases(),
  { find: /^typescript$/, replacement: join(HERE, 'typescript.ts') },
];

/** The assertions that ask the type checker: every one that imports the shared `ts.Program`. */
export const TYPE_AWARE = readdirSync(HERE)
  .filter((file) => file.endsWith('.test.ts'))
  .filter((file) => readFileSync(`${HERE}/${file}`, 'utf8').includes("from './program'"));

/**
 * One process with modules kept between files, so the program is built and checked once and
 * each assertion after the first reads types the checker already resolved.
 */
export default defineConfig({
  resolve: { alias: ALIASES },
  test: {
    name: 'architecture-typed',
    globals: true,
    environment: 'node',
    include: TYPE_AWARE,
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true, isolate: false } },
  },
});
