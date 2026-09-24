import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { sourceAliases } from './workspace-sources';

const HERE = import.meta.dirname;

/** The assertions that ask the type checker: every one that imports the shared `ts.Program`. */
export const TYPE_AWARE = readdirSync(HERE)
  .filter((file) => file.endsWith('.test.ts'))
  .filter((file) => readFileSync(`${HERE}/${file}`, 'utf8').includes("from './program'"));

/**
 * A fork per assertion, side by side with the AST thread. Each builds the smallest program it needs
 * (`serverProgram` or `productionProgram`), which costs less than waiting in one fork for the others.
 */
export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    name: 'architecture-typed',
    globals: true,
    environment: 'node',
    include: TYPE_AWARE,
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { isolate: false } },
  },
});
