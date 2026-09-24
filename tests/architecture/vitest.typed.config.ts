import { defineConfig } from 'vitest/config';
import { sourceAliases } from './workspace-sources';

/** The assertions that ask the type checker; they share the one `ts.Program` in `program.ts`. */
export const TYPE_AWARE = [
  'env-keys-consumed.test.ts',
  'no-discarded-result.test.ts',
  'promql-labels-emitted.test.ts',
];

/**
 * One process with modules kept between files, so the program is built and checked once and
 * each assertion after the first reads types the checker already resolved.
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
    poolOptions: { forks: { singleFork: true, isolate: false } },
  },
});
