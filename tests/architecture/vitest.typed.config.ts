import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { sourceAliases } from './workspace-sources';

const HERE = import.meta.dirname;

/** The assertions that ask the type checker: every one that imports the shared `ts.Program`. */
export const TYPE_AWARE = readdirSync(HERE)
  .filter((file) => file.endsWith('.test.ts'))
  .filter((file) => readFileSync(`${HERE}/${file}`, 'utf8').includes("from './program'"));

/**
 * One process with modules kept between files, so the program is built and checked once and
 * each assertion after the first reads types the checker already resolved.
 */
export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    name: 'architecture-typed',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    environment: 'node',
    include: TYPE_AWARE,
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true, isolate: false } },
  },
});
