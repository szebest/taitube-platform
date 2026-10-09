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
 * One fork in a group of its own, run first: Vitest 5 batches a one-worker project into a single task,
 * so the program is built once and every later assertion reads types the checker already resolved.
 * Sharing a group with `architecture` puts both on one queue, and two workers build it twice.
 */
export default defineConfig({
  resolve: { alias: ALIASES },
  test: {
    name: 'architecture-typed',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    environment: 'node',
    include: TYPE_AWARE,
    testTimeout: 30_000,
    pool: 'forks',
    maxWorkers: 1,
    sequence: { groupOrder: 1 },
    isolate: false,
  },
});
